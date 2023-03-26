/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './views/**/*.{html,ejs}', './public/**/*.{html,ejs}'
    ],
    theme: {
        extend: {
            colors: {
                'elithair': {
                    'menu': '#2569a8',
                }
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
    ],
}
