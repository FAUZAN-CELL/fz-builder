# Using the Builder (for developers)

## From source

This is simple enough:

```bash
git clone https://github.com/FAUZAN-CELL/fz-builder.git --depth=1 --no-tags
cd fz-builder
npm i
node .
```

Note that you need [git](https://git-scm.com/downloads) and [NodeJS >= 16](https://nodejs.org/en/) for this.

## Building a binary

This is also simple:

```bash
git clone https://github.com/FAUZAN-CELL/fz-builder.git --depth=1 --no-tags
cd fz-builder
npm i
npx pkg -t linux-x64,macos-x64,win-x64 -C GZip .
```
