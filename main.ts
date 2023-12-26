import {createCanvas, loadImage} from "https://deno.land/x/canvas@v1.4.1/mod.ts";

const filename = Deno.args[0] || "";

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

interface DisplayImageParams {
	imageData: Uint8ClampedArray;
	offsetX: number;
	width: number;
	height: number;
}

const rgbBlock = ({red, green, blue}: RGB) => `\x1b[48;2;${red};${green};${blue}m  \x1b[0m`;

const zoom = {
	out: async () => {
		// powershell -Command 'Add-Type -AssemblyName System.Windows.Forms; for ($i = 0; $i -lt 11; $i++) { [System.Windows.Forms.SendKeys]::SendWait(\"^-\") }'
		await new Deno.Command("powershell", {args: ["-Command", 'Add-Type -AssemblyName System.Windows.Forms; for ($i = 0; $i -lt 11; $i++) { [System.Windows.Forms.SendKeys]::SendWait("^-") }']}).output();
	},

	in: async () => {
		// powershell -Command 'Add-Type -AssemblyName System.Windows.Forms; for ($i = 0; $i -lt 11; $i++) { [System.Windows.Forms.SendKeys]::SendWait(\"^{.}\") }' (The dot is a workaround)
		await new Deno.Command("powershell", {args: ["-Command", 'Add-Type -AssemblyName System.Windows.Forms; for ($i = 0; $i -lt 11; $i++) { [System.Windows.Forms.SendKeys]::SendWait("^{.}") }']}).output();
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
	show: ({imageData, offsetX, width, height}: DisplayImageParams) => {
		let string = "\x1b[1G\x1b\x1b[1d";
		for (let row = 0; row < height; row++) {
			string += `[${offsetX * 2}G`;
			for (let column = 0; column < width; column++) {
				const index = (row * width + column) * 4;
				const pixel = [imageData[index], imageData[index + 1], imageData[index + 2]];
				string += rgbBlock({red: pixel[0], green: pixel[1], blue: pixel[2]});
			}
			string += "\n";
		}
		console.log(string);
	},
};

const title = {
	get: async () => new TextDecoder().decode((await new Deno.Command("powershell", {args: ["-Command", "$host.ui.RawUI.WindowTitle"]}).output()).stdout).trim(),
	set: (title: string) => console.log("\x1b]0;" + title + "\x07"),
};

let relativeName = filename.replaceAll("\\", "/");

if (!relativeName.includes("data:image")) relativeName = relativeName.split("/").pop()?.split("?")[0] || "";
else relativeName = "Image";

await display.init();

const displayDimensions = {
	height: Math.floor(Deno.consoleSize().rows * 0.99),
	width: Math.floor(Deno.consoleSize().columns / 2),
};

title.set(`${relativeName} @ ${displayDimensions.width}x${displayDimensions.height}px`);

const image = await loadImage(filename);

const scaleWidth = displayDimensions.width / image.width();
const scaleHeight = displayDimensions.height / image.height();
const scale = Math.min(scaleWidth, scaleHeight);

const canvas = createCanvas(Math.floor(image.width() * scale), Math.floor(image.height() * scale));
const ctx = canvas.getContext("2d");

const offsetX = Math.floor((displayDimensions.width - canvas.width) / 2);

ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const data = imageData.data;

display.show({imageData: data, offsetX, width: canvas.width, height: canvas.height});

let wait = true;
const stdin = Deno.stdin;
stdin.setRaw(true, {cbreak: Deno.build.os !== "windows"});

const maxBuffer = new Uint8Array(1024);
const read = async () => {
	const size = await stdin.read(maxBuffer);
	const buffer = maxBuffer.subarray(0, size || 0);

	for (const _byte of buffer) {
		wait = false;
	}

	setTimeout(read, 1000 / 60);
};
await read();

while (wait) await new Promise((resolve) => setTimeout(resolve, 100));

await display.end();
Deno.exit(0);