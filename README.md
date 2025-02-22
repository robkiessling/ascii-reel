# ascii-art-maker
A tool to help create ASCII animations!

Note: This tool does **not** convert images to ASCII; it is 
designed to aid manually drawing ASCII animations.


## Dev

### Directory structure

- `/patches`
    - Used by [patch-package](https://www.npmjs.com/package/patch-package)
    - I needed to make [a fix](https://github.com/robkiessling/gif-transparency/commit/01ddf34509631a1c733483f063f4e20e8ae036d2)
    to the [gif-transparency](https://www.npmjs.com/package/gif-transparency) package. 
    Just using patch-package for now so I don't have to put the fix in npm. 
    - If gif export is failing, make sure the patch has been loaded `npm run postinstall`