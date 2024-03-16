import {createCanvas, loadImage} from "https://deno.land/x/canvas@v1.4.1/mod.ts";

const filename = Deno.args[0] || "";
const deleteFrames = false;
const characterRenderDurationProcessingLimit = 10;

if (!filename) {
	console.error("No filename provided");
	Deno.exit(1);
}

if (!filename.includes("http") && !filename.includes("data:image")) {
	try {
		await Deno.stat(filename);
	} catch {
		console.error("File not found");
		Deno.exit(1);
	}
}

type RGB = {
	red: number;
	green: number;
	blue: number;
};

type DisplayImageParams = {
	imageData: Uint8ClampedArray;
	lastImage: Uint8ClampedArray;
	offsetX: number;
	width: number;
	height: number;
	frame: {
		current: number;
		total: number;
	};
};

type CenteredTextParams = {
	text: string;
	width: number;
	spacesAfter?: boolean;
	newLine?: number;
};

const rgbBlock = ({red, green, blue}: RGB) => `\x1b[48;2;${red};${green};${blue}m  \x1b[0m`;
const invertColor = ({red, green, blue}: RGB) => ({red: 255 - red, green: 255 - green, blue: 255 - blue});
// Amount is percentual. So if i say 1, the color will basically stay the same. If i say 0.5, i will get about 127, which is 50% of 255.
const darkenColor = ({red, green, blue, amount}: RGB & {amount: number}) => ({red: red * amount, green: green * amount, blue: blue * amount});

const zoom = {
	out: async () => {
		// powershell -Command 'Add-Type -AssemblyName System.Windows.Forms; for ($i = 0; $i -lt 11; $i++) { [System.Windows.Forms.SendKeys]::SendWait(\"^-\") }'
		await new Deno.Command("powershell", {args: ["-Command", 'Add-Type -AssemblyName System.Windows.Forms; for ($i = 0; $i -lt 8; $i++) { [System.Windows.Forms.SendKeys]::SendWait("^-") }']}).output();
	},

	in: async () => {
		// powershell -Command 'Add-Type -AssemblyName System.Windows.Forms; for ($i = 0; $i -lt 11; $i++) { [System.Windows.Forms.SendKeys]::SendWait(\"^{.}\") }' (The dot is a workaround)
		await new Deno.Command("powershell", {args: ["-Command", 'Add-Type -AssemblyName System.Windows.Forms; for ($i = 0; $i -lt 8; $i++) { [System.Windows.Forms.SendKeys]::SendWait("^{.}") }']}).output();
	},
};

const display = {
	init: async () => {
		console.log("\x1b[?1049h\x1b[1G\x1b\x1b[1d");
		await zoom.out();
	},
	end: async () => {
		console.log("\x1b[?1049l\x1b[1F");
		await zoom.in();
	},
	show: ({imageData, lastImage, offsetX, width, height, frame}: DisplayImageParams) => {
		// Darken the second last row to 0.5
		for (let column = 0; column < width; column++) {
			const index = (height - 2) * width * 4 + column * 4;
			const pixel = [imageData[index], imageData[index + 1], imageData[index + 2]];
			const darkenedPixel = darkenColor({red: pixel[0], green: pixel[1], blue: pixel[2], amount: 0.75});
			imageData[index] = darkenedPixel.red;
			imageData[index + 1] = darkenedPixel.green;
			imageData[index + 2] = darkenedPixel.blue;
		}

		// On the last row, show a progress bar. The progress bar will stretch along the whole width. So if 100 of 500 frames are done, the progress bar will be 20% of the width. The pixels (20% from left to right) will be inverted (white to black, black to white, for example).
		const progress = Math.floor((frame.current / frame.total) * width);
		for (let column = 0; column < width; column++) {
			const index = (height - 1) * width * 4 + column * 4;
			const pixel = [imageData[index], imageData[index + 1], imageData[index + 2]];
			const invertedPixel = invertColor({red: pixel[0], green: pixel[1], blue: pixel[2]});
			imageData[index] = column < progress ? invertedPixel.red : pixel[0];
			imageData[index + 1] = column < progress ? invertedPixel.green : pixel[1];
			imageData[index + 2] = column < progress ? invertedPixel.blue : pixel[2];
		}

		let string = "\x1b[1G\x1b\x1b[1d";
		for (let row = 0; row < height; row++) {
			for (let column = 0; column < width; column++) {
				if (
					//
					imageData[row * width * 4 + column * 4] === lastImage[row * width * 4 + column * 4] &&
					imageData[row * width * 4 + column * 4 + 1] === lastImage[row * width * 4 + column * 4 + 1] &&
					imageData[row * width * 4 + column * 4 + 2] === lastImage[row * width * 4 + column * 4 + 2]
				) {
					continue;
				}

				const index = (row * width + column) * 4;
				const pixel = [imageData[index], imageData[index + 1], imageData[index + 2]];
				// Also mention the absolute horizontal position using \x1b[indexG
				string += `\x1b[${(offsetX + column) * 2}G${rgbBlock({red: pixel[0], green: pixel[1], blue: pixel[2]})}`;
			}

			if (row < height - 1) string += "\n";
		}

		return {
			string,
			show: () => (console.log(string), string),
			estimatedTime: string.length * (characterRenderDurations.slice(0 - characterRenderDurationProcessingLimit).reduce((a, b) => a + b, 0) / characterRenderDurations.slice(0 - characterRenderDurationProcessingLimit).length),
		};
	},
};

const centeredText = ({text, width, spacesAfter = false, newLine = 0}: CenteredTextParams) => {
	// deno-lint-ignore no-control-regex
	const ansiCodeRegex = /\x1b\[[0-9;]*m/g;
	const textWithoutAnsiCodes = text.replace(ansiCodeRegex, "");
	const spaces = " ".repeat((width - textWithoutAnsiCodes.length) / 2);
	let centeredText = spaces + text;
	spacesAfter && (centeredText += " ".repeat(width - centeredText.length));

	for (let i = 0; i < newLine; i++) centeredText += "\n";

	return centeredText;
};

const title = {
	current: "",
	get: async () => new TextDecoder().decode((await new Deno.Command("powershell", {args: ["-Command", "$host.ui.RawUI.WindowTitle"]}).output()).stdout).trim(),
	set: (newTitle: string) => {
		title.current = newTitle;
		console.log("\x1b[1d\x1b]0;" + newTitle + "\x07");
	},
};

const exit = async () => {
	await display.end();
	stdin.setRaw(false);
	stdin.close();
	deleteFrames && Deno.removeSync(folder, {recursive: true});
	Deno.exit(0);
};

let relativeName = filename.replaceAll("\\", "/");

if (!relativeName.includes("data:image")) relativeName = relativeName.split("/").pop()?.split("?")[0] || "";
else relativeName = "Image";

// Create a folder called "temp-$(startRender)" and use ffmpeg to extract all frames of the input video to that folder
const folder = `frames-${Date.now()}`;
Deno.mkdirSync(folder);

// Get FPS and duration of the video: ffprobe -i filename -print_format json -show_streams -count_frames

let done = false;
let frames = 0;
(async () => {
	await new Deno.Command("ffmpeg", {args: ["-i", filename, `${folder}/frame%08d.png`, "-threads", "1"]}).output();
	done = true;
	for (const _frame of Deno.readDirSync(folder)) frames++;
})();

await display.init();

const displayDimensions = {
	height: 0,
	width: 0,
	old: {
		height: 0,
		width: 0,
	},
	update: () => {
		displayDimensions.height = Math.floor(Deno.consoleSize().rows - 1);
		displayDimensions.width = Math.floor(Deno.consoleSize().columns / 2 - 1);
		displayDimensions.old = {
			height: displayDimensions.height,
			width: displayDimensions.width,
		};
	},
};

// Create a loop of all frames
let lastFrameData: Uint8ClampedArray = new Uint8ClampedArray(0);
let frame = 1;

const player = {
	isPaused: false,
	playAfterExitingMenu: true,
	pause: () => (player.isPaused = true),
	play: () => (player.isPaused = false),
	togglePause: () => (player.isPaused = !player.isPaused),

	fpsLimit: new TextDecoder().decode((await new Deno.Command("ffprobe", {args: ["-v", "error", "-select_streams", "v", "-of", "default=noprint_wrappers=1:nokey=1", "-show_entries", "stream=r_frame_rate", filename]}).output()).stdout).split("/")[0] as unknown as number,

	refreshScreen: false,
	refreshScreenF: (clear: boolean) => {
		player.refreshScreen = true;
		clear && console.clear();
	},
};

const characterRenderDurations: number[] = [];
const addCharacterRenderDuration = (time: number) => time >= 0 && (characterRenderDurations.push(time), characterRenderDurations.length > characterRenderDurationProcessingLimit && characterRenderDurations.shift());
let lastFrameTimestamp = Date.now();

(async () => {
	while (true) {
		if (done && frame >= frames) {
			const newTitle = "Video finished";
			if (title.current !== newTitle) title.set(newTitle);
			
			await new Promise((resolve) => setTimeout(resolve, 5));
			continue;
		}
		let frameExists = false;

		while (player.isPaused && !player.refreshScreen) await new Promise((resolve) => setTimeout(resolve, 5));

		while (!frameExists) {
			try {
				Deno.statSync(`${folder}/frame${("0".repeat(8) + frame).slice(-8)}.png`);

				const image = await loadImage(`${folder}/frame${("0".repeat(8) + frame).slice(-8)}.png`);

				displayDimensions.update();
				if (displayDimensions.height !== displayDimensions.old.height || displayDimensions.width !== displayDimensions.old.width) console.clear();

				const scaleWidth = displayDimensions.width / image.width();
				const scaleHeight = displayDimensions.height / image.height();
				const scale = Math.min(scaleWidth, scaleHeight);

				const canvas = createCanvas(Math.floor(image.width() * scale), Math.floor(image.height() * scale));
				const ctx = canvas.getContext("2d");

				const offsetX = Math.floor((displayDimensions.width - canvas.width) / 2);

				ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
				const data = imageData.data;

				const displayImage = display.show({imageData: data, lastImage: !player.refreshScreen ? lastFrameData : new Uint8ClampedArray(0), offsetX, width: canvas.width, height: canvas.height, frame: {current: frame, total: frames}});
				const startRender = Date.now();
				const startNextFrame = startRender + Math.min(100, Math.max(1000 / player.fpsLimit, displayImage.estimatedTime) / 1.25);
				displayImage.show();

				lastFrameData = data;

				// Show fps in title (0.10 accuracy)
				!player.isPaused && title.set(`${Math.floor((1000 / (Date.now() - lastFrameTimestamp)) * 10) / 10}fps`);

				frameExists = true;
				lastFrameTimestamp = Date.now();
				!player.isPaused && frame++;
				displayImage.string.length >= 256 && addCharacterRenderDuration((Date.now() - startRender) / displayImage.string.length);
				player.refreshScreen && (player.refreshScreen = false);
				while (Date.now() < startNextFrame) await new Promise((resolve) => setTimeout(resolve, 1));
			} catch (_error) {
				// title.set("Waiting for frame " + frame + ".".repeat(Math.floor(Date.now() / 500) % 4));
				title.set(("0".repeat(8) + frame).slice(-8) + ".png" + ".".repeat(Math.floor(Date.now() / 500) % 4));
				Deno.writeTextFileSync("error.txt", _error + "\n", {append: true});
				await new Promise((resolve) => setTimeout(resolve, 50));
				if (done && frame >= frames) break;
			}
		}
	}
})();

const stdin = Deno.stdin;
stdin.setRaw(true, {cbreak: Deno.build.os !== "windows"});

let helpMenuVisible = false;

const maxBuffer = new Uint8Array(8192);
const read = async () => {
	const size = await stdin.read(maxBuffer);
	const buffer = maxBuffer.subarray(0, size || 0).toString();

	Deno.writeTextFileSync("keyboard.txt", buffer + "\n", {append: true});

	switch (buffer) {
		case "27": {
			// Escape
			if (helpMenuVisible) {
				helpMenuVisible = false;
				await zoom.out();
				player.refreshScreenF(true);
				player.play();
				break;
			}

			player.pause();
			await new Promise((resolve) => setTimeout(resolve, 100));
			await exit();
			break;
		}

		case "32": {
			// Space
			if (helpMenuVisible) break;

			player.togglePause();
			player.isPaused && title.set("Paused");
			player.refreshScreenF(false);
			break;
		}

		case "27,91,67": {
			// Right arrow
			if (helpMenuVisible) break;

			frame = Math.min(frame + 10, frames);
			player.isPaused && player.refreshScreenF(false);
			break;
		}

		case "27,91,68": {
			// Left arrow
			if (helpMenuVisible) break;

			frame = Math.max(frame - 10, 1);
			player.isPaused && player.refreshScreenF(false);
			break;
		}

		case "27,91,49,53,126": {
			// F5
			if (helpMenuVisible) break;

			player.refreshScreenF(true);
			break;
		}

		case "27,79,80": {
			// F1
			helpMenuVisible = !helpMenuVisible;
			if (!helpMenuVisible) {
				await zoom.out();
				player.refreshScreenF(true);
				player.playAfterExitingMenu && player.play();
				break;
			}

			player.isPaused = true;
			title.set("Help");

			console.clear();
			await zoom.in();

			let buttonDefinitionMaxWidth = 0;

			const text = [];

			const keys: {key: string; description: string; color?: number}[] = [
				{key: "Escape", description: "Exit"},
				{key: "Space", description: "Pause / Resume"},
				{key: "Right Arrow", description: "Skip 10 frames forward"},
				{key: "Left Arrow", description: "Skip 10 frames backward"},
				{key: "F1", description: "Show / Hide this menu"},
				{key: "F5", description: "Refresh screen"},
			];

			for (const key of keys) buttonDefinitionMaxWidth = Math.max(buttonDefinitionMaxWidth, key.key.length);
			buttonDefinitionMaxWidth += 2;

			for (const key of keys) {
				text.push((key.color ? `\x1b[${key.color}m` : "") + centeredText({text: key.key, width: buttonDefinitionMaxWidth, spacesAfter: true}) + ": " + key.description + (key.color ? `\x1b[0m` : "") + "\n");
			}

			text.unshift(centeredText({text: "Keyboard Actions", width: text.reduce((max, string) => Math.max(max, string.length), 0), newLine: 2}));

			console.log(text.join(""));
			break;
		}
	}

	setTimeout(read, 1000 / 60);
};

read();
