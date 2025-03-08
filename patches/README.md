# patch-package

This directory is used by the [patch-package](https://www.npmjs.com/package/patch-package) library.

I used patch-package because I needed to make
[a small bug fix](https://github.com/robkiessling/gif-transparency/commit/01ddf34509631a1c733483f063f4e20e8ae036d2)
to the [gif-transparency](https://www.npmjs.com/package/gif-transparency) package.
I'm using patch-package for now so I don't have to put the fixed build in npm. 

If gif export is failing, make sure the patch has been loaded: `npm run postinstall`