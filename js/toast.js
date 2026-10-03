// Short messages at the bottom of the screen, with an optional action such as Undo.

const VISIBLE_MS = 6000;

export function showToast(message, { type = 'success', actionLabel, onAction } = {}) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const text = document.createElement('span');
    text.textContent = message;
    toast.append(text);

    const dismiss = () => toast.remove();

    if (actionLabel) {
        const action = document.createElement('button');
        action.className = 'toast-action';
        action.textContent = actionLabel;
        action.addEventListener('click', () => {
            dismiss();
            onAction();
        });
        toast.append(action);
    }

    document.getElementById('toastRegion').append(toast);
    setTimeout(dismiss, VISIBLE_MS);
}
