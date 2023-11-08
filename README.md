# Image Viewer by DNA
Hello,
this is a project I made just for fun, which allows you to view images in the terminal. Written in TypeScript with [Deno](https://deno.land/)

## How to use
- I recommend using Windows-Terminal
- In Windows-Terminal, in order to get the automatic zoom (for better resolution) working, you'll need to create a specific keybind.
- Usage: `img.exe <path to image>` -> `img.exe E:\test.png`
- To exit just hit enter

### Setting up Windows-Terminal
![Step 1](doc/1.png)
![Step 2](doc/2.png)
![Step 3](doc/3.png)
![Step 4](doc/4.png)
![Step 5](doc/5.png)
![Step 6](doc/6.png)
![Step 7](doc/7.png)

## Compiling
- Install [Deno](https://deno.land/)
- Run `deno compile -o img.exe -A main.ts` in the project directory