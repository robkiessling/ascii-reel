import * as actions from "../io/actions.js";


let $mainMenu, mainMenu;

export function init() {
    $mainMenu = $('#main-menu');
    mainMenu = createHorizontalMenu($mainMenu, $li => refresh());
}

export function refresh() {
    if (mainMenu.isShowing()) {
        $mainMenu.find('.action-item').each((index, item) => {
            const $item = $(item);
            const action = actions.getActionInfo($item.data('action'));

            if (action) {
                let html = `<span>${action.name}</span>`;
                if (action.shortcutAbbr) {
                    html += `<span class="shortcut">${action.shortcutAbbr}</span>`;
                }
                $item.html(html);
                $item.off('click').on('click', () => action.callback());
                $item.toggleClass('disabled', !action.enabled);
            }
            else {
                $item.empty();
                $item.off('click');
            }
        });
    }
}

function createHorizontalMenu($menu, onOpen) {
    let isShowing = false;
    let $li = null;
    updateMenu();

    $menu.children('li').off('click').on('click', evt => {
        evt.stopPropagation();
        $li = $(evt.currentTarget);
        isShowing = !isShowing;
        updateMenu();
    });

    $menu.children('li').off('mouseenter').on('mouseenter', evt => {
        $li = $(evt.currentTarget);
        updateMenu();
    });

    $menu.children('li').off('mouseleave').on('mouseleave', evt => {
        if (!isShowing) {
            $li = null;
        }
        updateMenu();
    });

    function updateMenu() {
        $menu.find('li').removeClass('hovered visible');
        $(document).off('click.menu');

        if ($li) {
            $li.addClass('hovered');

            if (isShowing) {
                $li.addClass('visible');
                $(document).on('click.menu', evt => {
                    isShowing = false;
                    $li = null;
                    updateMenu();
                });
                if (onOpen) { onOpen($li); }
                // todo keybind 'esc' to close menu
            }
        }
    }

    // Return a small API we can use
    return {
        isShowing: () => isShowing,
        close: () => { isShowing = false; $li = null; updateMenu(); }
    }
}