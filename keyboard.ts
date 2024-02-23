const stdin = Deno.stdin;
stdin.setRaw(true, {cbreak: Deno.build.os !== "windows"});

const maxBuffer = new Uint8Array(1024);
const read = async () => {
	const size = await stdin.read(maxBuffer);
	const buffer = maxBuffer.subarray(0, size || 0).toString();

	if (buffer === "27") Deno.exit(0);

	console.log(buffer);

	setTimeout(read, 1000 / 60);
};

await read();
