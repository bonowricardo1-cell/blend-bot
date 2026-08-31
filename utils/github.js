const https = require('https');

async function salvarPixNoGitHub(pixConfig) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return;

    const owner = "bonowricardo1-cell";
    const repo = "blend-bot";
    const path = "config/pixConfig.json";
    const content = Buffer.from(JSON.stringify(pixConfig, null, 2)).toString('base64');

    try {
        const getSha = () => {
            return new Promise((resolve) => {
                const options = {
                    hostname: 'api.github.com',
                    path: `/repos/${owner}/${repo}/contents/${path}`,
                    method: 'GET',
                    headers: { 'User-Agent': 'Node.js-Bot', 'Authorization': `token ${token}` }
                };
                https.get(options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        if (res.statusCode === 200) resolve(JSON.parse(data).sha);
                        else resolve(null);
                    });
                }).on('error', () => resolve(null));
            });
        };

        const sha = await getSha();
        const data = JSON.stringify({
            message: "Atualizando pixConfig.json automaticamente pelo bot",
            content: content,
            sha: sha
        });

        const options = {
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/contents/${path}`,
            method: 'PUT',
            headers: {
                'User-Agent': 'Node.js-Bot',
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options);
        req.write(data);
        req.end();
    } catch (error) {
        console.error("Erro ao sincronizar com o GitHub:", error);
    }
}

module.exports = { salvarPixNoGitHub };
