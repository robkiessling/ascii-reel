import $ from "jquery";
import 'jquery-ui/ui/widgets/dialog.js';
import * as keyboard from "../io/keyboard.js";
import {hideAll} from "tippy.js";
import {defer} from "./utilities.js";

const $confirmDialog = $('#confirm-dialog');
createDialog($confirmDialog, null);

// Creates a simple yes/no dialog popup (no DOM elements need to exist)
export function confirmDialog(title, description, onAccept, acceptText = 'Ok') {
    $confirmDialog.dialog('option', 'title', title);
    $confirmDialog.find('p').html(description);

    $confirmDialog.dialog('option', 'buttons', [
        {
            text: 'Cancel',
            click: () => $confirmDialog.dialog("close")
        },
        {
            text: acceptText,
            class: 'call-out',
            click: () => {
                $confirmDialog.dialog('close');
                onAccept();
            }
        }
    ]);

    $confirmDialog.dialog('open');
}

// Creates a dialog popup with custom content ($dialog will already exist in HTML)
export function createDialog($dialog, onAccept, acceptText = 'Save', overrides = {}) {
    $dialog.dialog($.extend({
        autoOpen: false,
        width: 350,
        classes: {
            // "ui-dialog-titlebar-close": "ri ri-fw ri-close-line"
            "ui-dialog-titlebar-close": "hidden"
        },
        closeText: '',
        draggable: false,
        resizable: false,
        modal: true,
        open: () => {
            $('.ui-widget-overlay').on('click', () => {
                $dialog.dialog('close');
            });

            if ($dialog.parent().find('.ui-dialog-title').text().trim() === '') {
                $dialog.parent().find('.ui-dialog-titlebar').hide();
            }

            keyboard.toggleStandard(true);
            $(document).on('keyboard:enter.dialog', onAccept);

            $dialog.find('.highlight:first').select();
        },
        close: () => {
            keyboard.toggleStandard(false);
            defer(() => hideAll()); // Hide all tooltips (sometimes tooltips get stifled by dialog popup)
            $(document).off('keyboard:enter.dialog');
        },
        buttons: [
            {
                text: 'Cancel',
                click: () => $dialog.dialog("close")
            },
            {
                text: acceptText,
                class: 'call-out',
                click: onAccept
            }
        ]
    }, overrides));
}