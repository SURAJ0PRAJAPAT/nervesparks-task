
const fs = require('fs');
const path = require('path');

class ServerGenerator {
    constructor(configPath) {
        this.config = JSON.parse(fs.readFileSync(configPath));
        this.middleware = [];
        this.routes = [];
        this.imports = new Set([
            'const express = require("express");',
            'const cors = require("cors");',
            'const app = express();'
        ]);
    }

    validateStructure() {
        const requiredProps = {
            middleware: ['type'],
            route: ['endpoint', 'method'],
            entry: ['type'],
            exit: ['type']
        };
        
        this.config.nodes.forEach(node => {
            if (!node.properties.type) return;
            const props = requiredProps[node.properties.type] || [];
            props.forEach(prop => {
                if (!node.properties[prop]) {
                    throw new Error(`Missing required property '${prop}' in node ${node.id}`);
                }
            });
        });
    }

    generateMiddleware(node) {
        const middleware = {
            auth: `const authMiddleware = (req, res, next) => {
    if (!req.headers.authorization) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    next();
};`,
            admin: `const adminMiddleware = (req, res, next) => {
    if (req.headers.authorization !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
    }
    next();
};`,
            cors: (origins) => `app.use(cors({ origin: ${JSON.stringify(origins)} }));`
        };

        switch(node.properties.type) {
            case 'middleware':
                if(node.properties.allowed_origins) {
                    this.middleware.push(middleware.cors(node.properties.allowed_origins));
                }
                break;
            case 'auth':
                this.middleware.push(middleware.auth);
                break;
            case 'admin':
                this.middleware.push(middleware.admin);
                break;
        }
    }

    generateRoute(node) {
        const route = {
            method: node.properties.method.toLowerCase(),
            endpoint: node.properties.endpoint,
            middlewares: []
        };

        // Trace middleware chain
        let currentNode = node;
        while(currentNode.source) {
            const sourceNode = this.config.nodes.find(n => n.id === currentNode.source);
            if(sourceNode?.properties.type === 'middleware') {
                if(sourceNode.properties.auth_required) {
                    route.middlewares.push('authMiddleware');
                }
                if(sourceNode.properties.admin_required) {
                    route.middlewares.push('adminMiddleware');
                }
            }
            currentNode = sourceNode;
        }

        this.routes.push(route);
    }

    generateServer() {
        this.config.nodes.forEach(node => {
            switch(node.properties.type) {
                case 'middleware':
                    this.generateMiddleware(node);
                    break;
                case 'entry':
                    this.imports.add('app.use(express.json());');
                    break;
                case 'exit':
                    this.imports.add('const PORT = process.env.PORT || 3000;');
                    this.imports.add('app.listen(PORT, () => console.log(`Server running on port ${PORT}`));');
                    break;
                default:
                    if(node.properties.endpoint) {
                        this.generateRoute(node);
                    }
            }
        });

        const code = [
            Array.from(this.imports).join('\n'),
            this.middleware.join('\n\n'),
            this.routes.map(route => 
                `app.${route.method}("${route.endpoint}", ${route.middlewares.join(', ')}, (req, res) => {
    res.json({ message: "${route.endpoint.replace('/', '')} response" });
});`
            ).join('\n\n')
        ].join('\n\n');

        fs.writeFileSync('server.js', code);
    }
}

// Execute
const generator = new ServerGenerator(path.join(__dirname, 'config.json'));
generator.validateStructure();
generator.generateServer();
