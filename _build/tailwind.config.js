/** Tailwind config for pdfprivate.com. Build: see _build/README.md */
module.exports = {
    darkMode: 'class',
    content: [
        '../*.html',
        '../pages/*.html',
        '../js/*.js',
        './bodies/*.html',
        './build.py',
        './site_data.py'
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#f0fdf4',
                    100: '#dcfce7',
                    200: '#bbf7d0',
                    300: '#86efac',
                    400: '#4ade80',
                    500: '#22c55e',
                    600: '#16a34a',
                    700: '#15803d',
                    800: '#166534',
                    900: '#14532d'
                }
            }
        }
    }
};
