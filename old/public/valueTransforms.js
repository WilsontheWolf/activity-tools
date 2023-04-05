const transform = (key, value) => {
    if (key === 'timestamps') {
        const { start, end } = value;
        let str = '';
        if (start !== undefined) str += `Start: ${new Date(start).toLocaleString()} `;
        if (end !== undefined) str += `End: ${new Date(end).toLocaleString()}`;
        return str;
    } else if (key === 'buttons') {
        const div = document.createElement('div');

        value.forEach(({ label, url }) => {
            const p = document.createElement('p');
            p.style.margin = '0';
            const a = document.createElement('a');
            a.href = url;
            a.innerText = label;
            p.appendChild(a);
            div.appendChild(p);
        });

        return div;
    }
    return `${value}`;
}

export default transform;