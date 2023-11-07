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
const rgbBlock = ({red, green, blue}: RGB) => `\x1b[48;2;${red};${green};${blue}m  \x1b[0m`;

const title = {
	get: async () => new TextDecoder().decode((await new Deno.Command("powershell", {args: ["-Command", "$host.ui.RawUI.WindowTitle"]}).output()).stdout).trim(),
	set: (title: string) => console.log("\x1b]0;" + title + "\x07"),
};

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

let relativeName = filename.replaceAll("\\", "/");

// If the file doesnt include data:image, split the last part of the path
if (!relativeName.includes("data:image")) relativeName = relativeName.split("/").pop() || "";
else relativeName = "Image";

interface RGB {
	red: number;
	green: number;
	blue: number;
}

title.set(relativeName);
await zoom.out();

const displayDimensions = {
	height: Math.floor(Deno.consoleSize().rows * 0.99),
	width: Math.floor(Deno.consoleSize().columns / 2),
};

const image = await loadImage(filename);

// Calculate the scale for the image
const scaleWidth = displayDimensions.width / image.width();
const scaleHeight = displayDimensions.height / image.height();
const scale = Math.min(scaleWidth, scaleHeight);

const canvas = createCanvas(Math.floor(image.width() * scale), Math.floor(image.height() * scale));
const ctx = canvas.getContext("2d");

// Calculate the offset for centering the image
const offsetX = Math.floor((displayDimensions.width - canvas.width) / 2);
// const offsetY = Math.floor((displayDimensions.height - canvas.height) / 2);

ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

console.log("\x1b[?1049h");

for (let row = 0; row < canvas.height; row++) {
	let string = "";
	for (let column = 0; column < canvas.width; column++) {
		const data = ctx.getImageData(column, row, 1, 1);
		if (data) {
			const pixel = data.data;
			string += rgbBlock({red: pixel[0], green: pixel[1], blue: pixel[2]});
		}
	}

	console.log("  ".repeat(offsetX) + string);
}

// Wait, until any key is pressed. Not just enter
await Deno.stdin.read(new Uint8Array(1));

console.log("\x1b[?1049l[1F");
await zoom.in();
Deno.exit(0);
