import $ from "jquery";

const $preview = $('#preview');

export function updatePreview(canvas) {
    $preview.get(0).src = canvas.toDataURL("image/png");
}

