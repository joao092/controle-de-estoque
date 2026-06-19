const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

/* ==========================================================
   LOCALIZAR INDEX.HTML AUTOMATICAMENTE
========================================================== */

function buscarArquivoRecursivo(diretorioAlvo, nomeArquivo) {
    try {
        const arquivos = fs.readdirSync(diretorioAlvo);

        for (const arquivo of arquivos) {
            const caminhoCompleto = path.join(diretorioAlvo, arquivo);
            const stats = fs.statSync(caminhoCompleto);

            if (arquivo === "node_modules" || arquivo === ".git") {
                continue;
            }

            if (stats.isDirectory()) {
                const encontrado = buscarArquivoRecursivo(
                    caminhoCompleto,
                    nomeArquivo
                );

                if (encontrado) {
                    return encontrado;
                }
            } else if (
                arquivo.toLowerCase() === nomeArquivo.toLowerCase()
            ) {
                return caminhoCompleto;
            }
        }
    } catch (err) {
        console.error(
            "Erro ao procurar arquivo:",
            diretorioAlvo,
            err.message
        );
    }

    return null;
}

const diretorioRaizRender = "/opt/render/project/src";

let caminhoIndexFinal = buscarArquivoRecursivo(
    diretorioRaizRender,
    "index.html"
);

if (!caminhoIndexFinal) {
    caminhoIndexFinal = buscarArquivoRecursivo(
        process.cwd(),
        "index.html"
    );
}

if (caminhoIndexFinal) {
    console.log("\n========================================");
    console.log("INDEX ENCONTRADO:");
    console.log(caminhoIndexFinal);
    console.log("========================================\n");

    app.use(express.static(path.dirname(caminhoIndexFinal)));
} else {
    console.error("INDEX.HTML NÃO ENCONTRADO");

    caminhoIndexFinal = path.join(__dirname, "index.html");

    app.use(express.static(__dirname));
}

/* ==========================================================
   POSTGRESQL
========================================================== */

const DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://teste_w1lm_user:UreyHWpfvEiNyLMxRS01r4VVWIfLHrAX@dpg-d8ljvn57vvec73e6ook0-a.oregon-postgres.render.com/teste_w1lm";

console.log("DATABASE_URL:", DATABASE_URL ? "CONFIGURADA" : "NÃO CONFIGURADA");

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

/* ==========================================================
   TESTE DE CONEXÃO
========================================================== */

(async () => {
    try {
        const client = await pool.connect();

        console.log("PostgreSQL conectado com sucesso");

        client.release();
    } catch (err) {
        console.error("ERRO AO CONECTAR NO POSTGRESQL");
        console.error(err);
    }
})();

/* ==========================================================
   CRIAR TABELAS AUTOMATICAMENTE
========================================================== */

(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS produtos (
                id_produto SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                categoria VARCHAR(100) DEFAULT '',
                marca VARCHAR(100) DEFAULT '',
                quantidade INTEGER DEFAULT 0,
                preco_custo NUMERIC(10,2) DEFAULT 0,
                preco_venda NUMERIC(10,2) DEFAULT 0,
                estoque_minimo INTEGER DEFAULT 0,
                data_cadastro DATE DEFAULT CURRENT_DATE
            )
        `);

        try { await pool.query("ALTER TABLE produtos ADD COLUMN IF NOT EXISTS categoria VARCHAR(100) DEFAULT ''"); } catch(e) {}
        try { await pool.query("ALTER TABLE produtos ADD COLUMN IF NOT EXISTS marca VARCHAR(100) DEFAULT ''"); } catch(e) {}
        try { await pool.query("ALTER TABLE produtos ADD COLUMN IF NOT EXISTS data_cadastro DATE DEFAULT CURRENT_DATE"); } catch(e) {}

        console.log("Tabela produtos pronta");
    } catch (err) {
        console.error("Erro ao criar tabela produtos");
        console.error(err);
    }
})();

(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS movimentacoes (
                id_movimentacao SERIAL PRIMARY KEY,
                id_produto INTEGER NOT NULL REFERENCES produtos(id_produto),
                tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA')),
                quantidade INTEGER NOT NULL,
                data_movimentacao TIMESTAMP DEFAULT NOW()
            )
        `);

        try { await pool.query("ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS id_movimentacao SERIAL"); } catch(e) {}
        try { await pool.query("ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS id_produto INTEGER REFERENCES produtos(id_produto)"); } catch(e) {}
        try { await pool.query("ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) CHECK (tipo IN ('ENTRADA', 'SAIDA'))"); } catch(e) {}
        try { await pool.query("ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS quantidade INTEGER"); } catch(e) {}
        try { await pool.query("ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS data_movimentacao TIMESTAMP DEFAULT NOW()"); } catch(e) {}

        console.log("Tabela movimentacoes pronta");
    } catch (err) {
        console.error("Erro ao criar tabela movimentacoes");
        console.error(err);
    }
})();

(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id_usuario SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                senha VARCHAR(255) NOT NULL,
                funcao VARCHAR(100) DEFAULT 'Operador',
                token VARCHAR(255) DEFAULT NULL
            )
        `);

        const existe = await pool.query("SELECT COUNT(*) FROM usuarios");

            if (parseInt(existe.rows[0].count) === 0) {
            const senhaPadrao = crypto.createHash("sha256").update("admin123").digest("hex");

            await pool.query(
                `INSERT INTO usuarios (nome, email, senha, funcao)
                 VALUES ($1, $2, $3, $4)`,
                ["Administrador", "admin@estoque.com", senhaPadrao, "Administrador"]
            );

            console.log("Usuario padrao criado: admin@estoque.com / admin123");
        }

        try { await pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE"); } catch(e) {}
        try { await pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha VARCHAR(255)"); } catch(e) {}
        try { await pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS funcao VARCHAR(100) DEFAULT 'Operador'"); } catch(e) {}
        try { await pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token VARCHAR(255) DEFAULT NULL"); } catch(e) {}

        console.log("Tabela usuarios pronta");
    } catch (err) {
        console.error("Erro ao criar tabela usuarios");
        console.error(err);
    }
})();

(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS fornecedores (
                id_fornecedor SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                contato VARCHAR(100) DEFAULT '',
                telefone VARCHAR(50) DEFAULT '',
                email VARCHAR(100) DEFAULT ''
            )
        `);

        console.log("Tabela fornecedores pronta");
    } catch (err) {
        console.error("Erro ao criar tabela fornecedores");
        console.error(err);
    }
})();

(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS configuracoes (
                id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
                dados JSONB DEFAULT '{}',
                preferencias JSONB DEFAULT '{}'
            )
        `);

        await pool.query(`
            INSERT INTO configuracoes (id, dados, preferencias)
            VALUES (1, '{}', '{}')
            ON CONFLICT (id) DO NOTHING
        `);

        console.log("Tabela configuracoes pronta");
    } catch (err) {
        console.error("Erro ao criar tabela configuracoes");
        console.error(err);
    }
})();

/* ==========================================================
   ROTA PRINCIPAL
========================================================== */

app.get("/", (req, res) => {
    res.sendFile(caminhoIndexFinal);
});

/* ==========================================================
   LISTAR PRODUTOS
========================================================== */

app.get("/api/produtos", async (req, res) => {
    try {
        const resultado = await pool.query(
            "SELECT * FROM produtos ORDER BY nome ASC"
        );

        return res.status(200).json(resultado.rows);
    } catch (err) {
        console.error("ERRO GET PRODUTOS:");
        console.error(err);

        return res.status(500).json({
            erro: err.message
        });
    }
});

/* ==========================================================
   CADASTRAR PRODUTO
========================================================== */

app.post("/api/produtos", async (req, res) => {
    try {
        const {
            nome,
            categoria,
            marca,
            quantidade,
            preco_custo,
            preco_venda,
            estoque_minimo
        } = req.body;

        console.log("BODY RECEBIDO:", req.body);

        const resultado = await pool.query(
            `
            INSERT INTO produtos
            (
                nome,
                categoria,
                marca,
                quantidade,
                preco_custo,
                preco_venda,
                estoque_minimo
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            RETURNING *
            `,
            [
                nome,
                categoria || '',
                marca || '',
                quantidade,
                preco_custo,
                preco_venda,
                estoque_minimo
            ]
        );

        return res.status(201).json(resultado.rows[0]);
    } catch (err) {
        console.error("ERRO INSERT:");
        console.error(err);

        return res.status(500).json({
            erro: err.message
        });
    }
});

/* ==========================================================
   LISTAR MOVIMENTACOES
========================================================== */

app.get("/api/movimentacoes", async (req, res) => {
    try {
        const resultado = await pool.query(
            "SELECT * FROM movimentacoes ORDER BY data_movimentacao DESC"
        );

        return res.status(200).json(resultado.rows);
    } catch (err) {
        console.error("ERRO GET MOVIMENTACOES:");
        console.error(err);

        return res.status(500).json({
            erro: err.message
        });
    }
});

/* ==========================================================
   CRIAR MOVIMENTACAO
========================================================== */

app.post("/api/movimentacoes", async (req, res) => {
    try {
        const { id_produto, tipo, quantidade } = req.body;

        console.log("MOVIMENTACAO RECEBIDA:", req.body);

        const resultado = await pool.query(
            `
            INSERT INTO movimentacoes (id_produto, tipo, quantidade)
            VALUES ($1, $2, $3)
            RETURNING *
            `,
            [id_produto, tipo, quantidade]
        );

        if (tipo === 'SAIDA') {
            const prod = await pool.query(
                "SELECT quantidade FROM produtos WHERE id_produto = $1",
                [id_produto]
            );

            if (prod.rows.length === 0) {
                return res.status(404).json({ erro: "Produto não encontrado" });
            }

            const estoqueAtual = parseInt(prod.rows[0].quantidade);

            if (quantidade > estoqueAtual) {
                return res.status(400).json({
                    erro: "Estoque insuficiente",
                    estoqueAtual: estoqueAtual,
                    solicitado: quantidade
                });
            }

            await pool.query(
                "UPDATE produtos SET quantidade = quantidade - $1 WHERE id_produto = $2",
                [quantidade, id_produto]
            );
        } else if (tipo === 'ENTRADA') {
            await pool.query(
                "UPDATE produtos SET quantidade = quantidade + $1 WHERE id_produto = $2",
                [quantidade, id_produto]
            );
        }

        return res.status(201).json(resultado.rows[0]);
    } catch (err) {
        console.error("ERRO INSERT MOVIMENTACAO:");
        console.error(err);

        return res.status(500).json({
            erro: err.message
        });
    }
});

/* ==========================================================
   LOGIN
========================================================== */

app.post("/api/login", async (req, res) => {
    try {
        const { email, senha } = req.body;

        const senhaHash = crypto.createHash("sha256").update(senha).digest("hex");

        const resultado = await pool.query(
            "SELECT id_usuario, nome, email, funcao FROM usuarios WHERE email = $1 AND senha = $2",
            [email, senhaHash]
        );

        if (resultado.rows.length === 0) {
            return res.status(401).json({ erro: "Email ou senha incorretos" });
        }

        const usuario = resultado.rows[0];
        const token = crypto.randomBytes(32).toString("hex");

        await pool.query(
            "UPDATE usuarios SET token = $1 WHERE id_usuario = $2",
            [token, usuario.id_usuario]
        );

        return res.status(200).json({
            usuario: { id: usuario.id_usuario, nome: usuario.nome, email: usuario.email, funcao: usuario.funcao },
            token
        });
    } catch (err) {
        console.error("ERRO LOGIN:");
        console.error(err);

        return res.status(500).json({ erro: err.message });
    }
});

/* ==========================================================
   VERIFICAR SESSÃO
========================================================== */

app.get("/api/sessao", async (req, res) => {
    try {
        const token = req.headers.authorization;

        if (!token) {
            return res.status(401).json({ autenticado: false });
        }

        const resultado = await pool.query(
            "SELECT id_usuario, nome, email, funcao FROM usuarios WHERE token = $1",
            [token]
        );

        if (resultado.rows.length === 0) {
            return res.status(401).json({ autenticado: false });
        }

        return res.status(200).json({ autenticado: true, usuario: resultado.rows[0] });
    } catch (err) {
        console.error("ERRO SESSAO:");
        console.error(err);

        return res.status(500).json({ erro: err.message });
    }
});

/* ==========================================================
   LOGOUT
========================================================== */

app.post("/api/logout", async (req, res) => {
    try {
        const token = req.headers.authorization;

        if (token) {
            await pool.query(
                "UPDATE usuarios SET token = NULL WHERE token = $1",
                [token]
            );
        }

        return res.status(200).json({ mensagem: "Sessao encerrada" });
    } catch (err) {
        console.error("ERRO LOGOUT:");
        console.error(err);

        return res.status(500).json({ erro: err.message });
    }
});

/* ==========================================================
   FORNECEDORES - LISTAR
========================================================== */

app.get("/api/fornecedores", async (req, res) => {
    try {
        const resultado = await pool.query(
            "SELECT * FROM fornecedores ORDER BY nome ASC"
        );

        return res.status(200).json(resultado.rows);
    } catch (err) {
        console.error("ERRO GET FORNECEDORES:");
        console.error(err);

        return res.status(500).json({
            erro: err.message
        });
    }
});

/* ==========================================================
   FORNECEDORES - CADASTRAR
========================================================== */

app.post("/api/fornecedores", async (req, res) => {
    try {
        const { nome, contato, telefone, email } = req.body;

        const resultado = await pool.query(
            `INSERT INTO fornecedores (nome, contato, telefone, email)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [nome, contato || '', telefone || '', email || '']
        );

        return res.status(201).json(resultado.rows[0]);
    } catch (err) {
        console.error("ERRO INSERT FORNECEDOR:");
        console.error(err);

        return res.status(500).json({
            erro: err.message
        });
    }
});

/* ==========================================================
   FORNECEDORES - DELETAR
========================================================== */

app.delete("/api/fornecedores/:id", async (req, res) => {
    try {
        await pool.query(
            "DELETE FROM fornecedores WHERE id_fornecedor = $1",
            [req.params.id]
        );

        return res.status(200).json({ mensagem: "Fornecedor removido" });
    } catch (err) {
        console.error("ERRO DELETE FORNECEDOR:");
        console.error(err);

        return res.status(500).json({
            erro: err.message
        });
    }
});

/* ==========================================================
   CONFIGURACOES - GET
========================================================== */

app.get("/api/configuracoes", async (req, res) => {
    try {
        const resultado = await pool.query(
            "SELECT dados, preferencias FROM configuracoes WHERE id = 1"
        );

        if (resultado.rows.length === 0) {
            return res.status(200).json({ dados: {}, preferencias: {} });
        }

        return res.status(200).json(resultado.rows[0]);
    } catch (err) {
        console.error("ERRO GET CONFIGURACOES:");
        console.error(err);

        return res.status(500).json({
            erro: err.message
        });
    }
});

/* ==========================================================
   CONFIGURACOES - PUT
========================================================== */

app.put("/api/configuracoes", async (req, res) => {
    try {
        const { dados, preferencias } = req.body;

        const resultado = await pool.query(
            `
            UPDATE configuracoes
            SET dados = COALESCE($1::jsonb, dados),
                preferencias = COALESCE($2::jsonb, preferencias)
            WHERE id = 1
            RETURNING dados, preferencias
            `,
            [
                dados ? JSON.stringify(dados) : null,
                preferencias ? JSON.stringify(preferencias) : null
            ]
        );

        return res.status(200).json(resultado.rows[0]);
    } catch (err) {
        console.error("ERRO PUT CONFIGURACOES:");
        console.error(err);

        return res.status(500).json({
            erro: err.message
        });
    }
});

/* ==========================================================
   PORTA RENDER
========================================================== */

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
