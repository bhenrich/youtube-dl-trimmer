import './App.css';
import React, { useState } from 'react';

function App() {
	const [inputValue, setInputValue] = useState('');
	const [startTime, setStartTime] = useState('');
	const [endTime, setEndTime] = useState('');
	const [jobStatus, setJobStatus] = useState('');

	async function sendRequest(mp3) {
		try {
			const response = await fetch(`https://yuniiworks.de:5037/startJob?URL=${inputValue}&startTime=${startTime}&endTime=${endTime}&mp3=${mp3}`);
			const data = await response.json();
			const { uniqueID } = data;
			checkStatus(uniqueID);
		} catch (error) {
			console.error('Error sending initial request:', error);
		}
	}

	async function checkStatus(uniqueID) {
		try {
			const res = await fetch(`https://yuniiworks.de:5037/status?uniqueID=${uniqueID}`);
			const data = await res.json();

			// Log or display the data for debugging purposes
			console.log("Received status:", data);

			setJobStatus(data.status.charAt(0).toUpperCase() + data.status.slice(1));
			if (data.status === 'completed') {
				downloadFile(uniqueID);
			} else {
				setTimeout(() => checkStatus(uniqueID), 500); // Poll every 0.5 seconds
			}
		} catch (error) {
			setJobStatus('Error');
			console.error('Error checking status:', error);
		}
	}

	function downloadFile(uniqueID) {
		const a = document.createElement("a");
		a.href = `https://yuniiworks.de:5037/download?uniqueID=${uniqueID}`;
		a.setAttribute("download", "");
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}


	return (
		<div className="App">
			<div>
				<div className="status-area">
					<h2>Job Status:</h2>
					<p className={`status ${jobStatus.toLowerCase()}`}>{jobStatus}</p>
				</div>

				<h1 className="heading">YuNii's YouTube Downloader</h1>
				<input
					className="URL-input"
					placeholder="Video URL e.g. https://www.youtube.com/watch?v=MtN1YnoL46Q"
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
				/>
				<button
					className="convert-button"
					onClick={() => sendRequest(false)}
				>
					MP4
				</button>
				<button
					className="convert-button"
					onClick={() => sendRequest(true)}
					style={{ borderRadius: "0px 5px 5px 0px" }}
				>
					MP3
				</button><br />
				<input
					className="time-input"
					placeholder="Start Time (seconds)"
					value={startTime}
					onChange={(e) => setStartTime(e.target.value)}
				/>
				<input
					className="time-input"
					placeholder="Clip Length (seconds)"
					value={endTime}
					onChange={(e) => setEndTime(e.target.value)}
				/>
			</div>

			<div className="notice-area">
				<h2>Important Notices:</h2>
				<p className='notices'>
					&#x2022; I am currently having issues where the downloaded videos are in a lower resolution than the original. I am working on fixing this. <br />
					&#x2022; This service is still in development, so there may be bugs. It's also not in active development, so don't expect any updates or fixes unless you ask me to fix them. <br />
					&#x2022; This service is hosted on a cheap server, so it may be slow or unresponsive at times (especially if multiple people are using it). Rest assured it's working, just give it some time. <br />
					&#x2022; This service is not meant to be used for piracy. Please only use it to download videos you have the rights to download. <br />
					&#x2022; This service is meant for downloading trimmed clips using the start and end time inputs. If you want to download the whole video, just leave the start and end time inputs blank, but expect long wait times. <br />
					<b>&#x2022; And most importantly: Please don't just share this with anybody. This is meant for me and a couple of close friends, the more people use it, the more likely it is to get even slower.</b> <br />
				</p>
			</div>
		</div>
	);
}

export default App;