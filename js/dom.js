// Small DOM helpers shared by the views. Text always goes in through
// textContent or attributes, never innerHTML.

const SVG_NS = 'http://www.w3.org/2000/svg';

export const $ = id => document.getElementById(id);

export function el(tag, props = {}, children = []) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
}

export function svg(tag, attrs = {}, children = []) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    node.append(...children);
    return node;
}

export function table(headers, rows, className = 'data-table') {
    return el('table', { className }, [
        el('thead', {}, [el('tr', {}, headers.map(h => el('th', { textContent: h })))]),
        el('tbody', {}, rows.map(cells => el('tr', {}, cells.map(cell =>
            cell instanceof Node ? el('td', {}, [cell]) : el('td', { textContent: cell })))))
    ]);
}
