const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;
const FONTS_DIR = path.join(__dirname, 'authority-font-family');
const OUTPUT_DIR = path.join(__dirname, 'renders');

// Asegurar que exista la carpeta de salida
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

// Obtener IPs locales para facilitar conexión desde el móvil
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const k in interfaces) {
        for (const k2 in interfaces[k]) {
            const address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                addresses.push(address.address);
            }
        }
    }
    return addresses;
}

const server = http.createServer((req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    // API: Listar fuentes en la carpeta
    if (pathname === '/api/fonts' && req.method === 'GET') {
        fs.readdir(FONTS_DIR, (err, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'No se pudo leer la carpeta de fuentes' }));
                return;
            }

            const fontExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
            const fonts = files
                .filter(file => fontExtensions.includes(path.extname(file).toLowerCase()))
                .map(file => {
                    // Nombre limpio para la fuente
                    const name = path.basename(file, path.extname(file))
                        .replace(/[-_]/g, ' ');
                    return { name, filename: file };
                });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ fonts }));
        });
        return;
    }

    // API: Guardar imagen PNG renderizada
    if (pathname === '/api/save' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (!data.image) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Falta la imagen' }));
                    return;
                }

                // Limpiar prefijo base64
                const base64Data = data.image.replace(/^data:image\/png;base64,/, "");
                const timestamp = Date.now();
                const filename = `texto_${timestamp}.png`;
                const filePath = path.join(OUTPUT_DIR, filename);

                fs.writeFile(filePath, base64Data, 'base64', (err) => {
                    if (err) {
                        console.error('Error al guardar archivo:', err);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Error al escribir el archivo en el disco' }));
                        return;
                    }

                    console.log(`Imagen guardada exitosamente: ${filePath}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: true, 
                        filename, 
                        path: `/renders/${filename}`,
                        absolutePath: filePath 
                    }));
                });
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'JSON inválido' }));
            }
        });
        return;
    }

    // Servir recursos estáticos
    let filePath = '';
    let contentType = 'text/html';

    if (pathname === '/' || pathname === '/index.html') {
        filePath = path.join(__dirname, 'index.html');
        contentType = 'text/html';
    } else if (pathname.startsWith('/fonts/')) {
        const fontFile = decodeURIComponent(pathname.substring(7));
        filePath = path.join(FONTS_DIR, fontFile);
        
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.ttf') contentType = 'font/ttf';
        else if (ext === '.otf') contentType = 'font/otf';
        else if (ext === '.woff') contentType = 'font/woff';
        else if (ext === '.woff2') contentType = 'font/woff2';
        else contentType = 'application/octet-stream';
    } else if (pathname.startsWith('/renders/')) {
        const renderFile = decodeURIComponent(pathname.substring(9));
        filePath = path.join(OUTPUT_DIR, renderFile);
        contentType = 'image/png';
    } else {
        // Por si acaso cargan recursos relativos
        filePath = path.join(__dirname, pathname);
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.js') contentType = 'application/javascript';
        else if (ext === '.css') contentType = 'text/css';
        else if (ext === '.json') contentType = 'application/json';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.jpg') contentType = 'image/jpeg';
    }

    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Internal Server Error');
                return;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        });
    });
});

server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 SERVIDOR INICIADO CORRECTAMENTE`);
    console.log(`==================================================`);
    console.log(`Acceso local (desde esta PC):`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`\nAcceso desde tu móvil (debe estar en el mismo Wi-Fi):`);
    
    const ips = getLocalIPs();
    if (ips.length > 0) {
        ips.forEach(ip => {
            console.log(`👉 http://${ip}:${PORT}`);
        });
    } else {
        console.log(`⚠️  No se detectaron IPs locales de red activa. Asegúrate de estar conectado a Wi-Fi.`);
    }
    console.log(`==================================================`);
    console.log(`Fuentes leídas de: ${FONTS_DIR}`);
    console.log(`Imágenes guardadas en: ${OUTPUT_DIR}`);
    console.log(`==================================================`);
});
