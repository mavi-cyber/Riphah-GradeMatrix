// Confirm dialog built on the #customModal markup.

const overlay = () => document.getElementById('customModal');

function makeButton(label, className, onClick) {
    const button = document.createElement('button');
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
}

export function closeModal() {
    overlay().hidden = true;
}

export function showConfirm(title, message, onConfirm, confirmLabel = 'Confirm') {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;

    const cancel = makeButton('Cancel', 'btn btn-ghost', closeModal);
    const confirm = makeButton(confirmLabel, 'btn btn-danger', () => {
        closeModal();
        onConfirm();
    });

    document.getElementById('modalButtons').replaceChildren(cancel, confirm);
    overlay().hidden = false;
    cancel.focus();
}

export function initModal() {
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeModal();
    });
    overlay().addEventListener('click', event => {
        if (event.target === overlay()) closeModal();
    });
}
