const express = require('express');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const ytdl = require('ytdl-core');
const { spawn } = require('child_process');

const app = express();
const port = 5037;

// Your SSL Certs here
const credentials = {
    key: fs.readFileSync('/etc/letsencrypt/live/yuniiworks.de/privkey.pem', 'utf8'),
    cert: fs.readFileSync('/etc/letsencrypt/live/yuniiworks.de/cert.pem', 'utf8'),
    ca: fs.readFileSync('/etc/letsencrypt/live/yuniiworks.de/chain.pem', 'utf8'),
};

app.use(cors());

let processingQueue = [];
let jobStatus = {};

// Initialize job
app.get('/startJob', (req, res) => {
    const uniqueID = Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    const { mp3 } = req.query;
    const outputFormat = mp3 === 'true' ? 'mp3' : 'mp4';

    // Initialize jobStatus[uniqueID] if it doesn't exist
    if (!jobStatus[uniqueID]) {
        jobStatus[uniqueID] = {};
    }

    jobStatus[uniqueID].status = 'queued';
    jobStatus[uniqueID].outputFormat = outputFormat;

    processingQueue.push({ req, uniqueID });
    res.json({ uniqueID });
});

app.get('/status', (req, res) => {
    const { uniqueID } = req.query;
    console.log(`[${uniqueID}] Received status request: ${jobStatus[uniqueID].status}`);
    res.json({ status: jobStatus[uniqueID].status || 'unknown' });
});

app.get('/download', (req, res) => {
    const { uniqueID } = req.query;
    if (jobStatus[uniqueID] && jobStatus[uniqueID].status === 'completed') {
        const outputFormat = jobStatus[uniqueID].outputFormat;
        res.header('Content-Disposition', `attachment; filename="output_${uniqueID}.${outputFormat}"`);
        res.download(`./temp/output_${uniqueID}.${outputFormat}`);
    } else {
        res.status(400).send('File not ready for download');
    }
});



async function processQueue() {
    while (processingQueue.length > 0) {
        const { req, uniqueID } = processingQueue.shift();
        await processVideo(req, uniqueID);
    }
}



async function processVideo(req, uniqueID) {
    jobStatus[uniqueID].status = 'processing';

    console.log(`[${uniqueID}] Starting video processing`);
    const { URL, startTime, endTime, mp3 } = req.query;
    console.log(`[${uniqueID}] URL: `, URL, "startTime: ", startTime, "endTime: ", endTime, "mp3: ", mp3);

    // Default startTime and endTime settings
    const ss = startTime || '00:00:00';
    const to = endTime || null;

    // Output filename and format
    var outputFilename;
    var outputFormat;
    if (mp3 == "true") {
        outputFilename = 'audio.mp3';
        outputFormat = 'mp3';
    } else {
        outputFilename = 'video.mp4';
        outputFormat = 'mp4';
    }

    // Get video info
    const info = await ytdl.getInfo(URL);
    const format = ytdl.chooseFormat(info.formats, { quality: 'highest' });
    console.log(`[${uniqueID}] Format found:`, format);

    const videoStream = ytdl.downloadFromInfo(info, { format: format });
    const videoPath = `./temp/original_${uniqueID}.mp4`;

    const videoWriteStream = fs.createWriteStream(videoPath);
    videoStream.pipe(videoWriteStream);

    await new Promise((resolve, reject) => {
        videoWriteStream.on('finish', resolve);
        videoWriteStream.on('error', reject);
    });

    console.log(`[${uniqueID}] Successfully downloaded video stream`);

    const ffmpegArgs = [
        '-ss', ss,
        '-i', videoPath
    ];

    if (to) {
        ffmpegArgs.push('-to', to);
    }

    if (mp3 == "true") {
        ffmpegArgs.push('-q:a', '0', '-map', 'a', '-y');
    } else {
        ffmpegArgs.push('-vf', 'scale=-1:1080', '-b:v', '8M', '-c:v', 'libx264', '-crf', '20', '-f', 'mp4', '-y');
    }

    ffmpegArgs.push(`./temp/output_${uniqueID}.${outputFormat}`);

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    ffmpeg.stderr.on('data', (data) => {
        console.error(`[${uniqueID}] FFmpeg stderr: ${data}`);
    });

    await new Promise((resolve, reject) => {
        ffmpeg.on('close', (code) => {
            if (code !== 0) {
                console.error(`[${uniqueID}] FFmpeg exited with code ${code}`);
                reject();
            } else {
                console.log(`[${uniqueID}] FFmpeg processing complete.`);
                resolve();
            }
        });
    });

    console.log(`[${uniqueID}] Finished Video Conversion`);

    // Delete the temporary files 2 hours after original download
    setTimeout(() => {
        fs.unlink(`./temp/original_${uniqueID}.mp4`, err => {
            if (err) console.error(`[${uniqueID}] Error deleting original file: ${err}`);
        });
        console.log(`Deleted File original_${uniqueID}.mp4`);
        fs.unlink(`./temp/output_${uniqueID}.${outputFormat}`, err => {
            if (err) console.error(`[${uniqueID}] Error deleting output file: ${err}`);
        });
        console.log(`Deleted File output_${uniqueID}.${outputFormat}`);
    }, 7200000);

    // Once done, mark as completed
    jobStatus[uniqueID] = {
        status: 'completed',
        outputFormat: outputFormat // Store the outputFormat here
    };
    console.log(`[${uniqueID}] Updated jobStatus:`, jobStatus[uniqueID].status);
    console.log(`[${uniqueID}] Job completed: ${jobStatus[uniqueID]}`);
}

// Start processing jobs in the background
setInterval(processQueue, 1000);

const httpsServer = https.createServer(credentials, app);
httpsServer.listen(port, () => {
    console.log(`Server running on https://yuniiworks.de:${port}`);
});
