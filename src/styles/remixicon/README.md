# Remixicon Font

The Remixicon font allows us to easily make icons using HTML class
names, such as:

```html
<span class="ri ri-fw ri-add-circle-line"></span>
```

In the above example, `ri-fw` makes the icon a fixed width
(we typically apply this to every icon used).

## npm vs. manual font download

Originally I used remixicon through npm, i.e.

```
npm install remixicon
```

But unfortunately there is no tree-shaking, so the bundled font
is quite large since it includes every icon.

Instead, I've opted to manually build a font on https://remixicon.com
using just the icons I need.

## How to add more icons to the font

1. Navigate to https://remixicon.com.
2. On the right of the icon search bar, there is a folder icon representing your "Collection".
Click this icon, then click "Import Collection".
3. Upload the `RemixIcon_Collection.remixicon` file from this directory. 
This will populate the collection of selected icons in the UI.
4. Add/subtract any icons you want.
5. Click the "Collection" button again, this time click "Export Collection"
to download an updated `.remixicon` file. Name it `RemixIcon_Collection.remixicon` and 
replace the existing file in this directory.
6. Click the "↓ Fonts" button to download a zip of the various font files.
7. Expand the zip and copy the `.css` and `.woff2` files to this directory
(replacing the existing files).
You don't need any of the other formats since I don't care about supporting older browsers
and I just use font-based classes.
8. In the `remixicon.css` file, update the `@font-face`:
  - In `src`, delete all urls except for the `.woff2` one.
  - Prepend `remixicon/` to the kept urls because our build uses absolute urls. 
  - The final result should look like:

```css
@font-face {
    font-family: "remixicon";
    src: url("remixicon/remixicon.woff2?t=1744085091249") format("woff2");
    font-display: swap;
}
```