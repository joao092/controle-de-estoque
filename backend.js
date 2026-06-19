const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
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

        console.log("✅ PostgreSQL conectado com sucesso");

        client.release();
    } catch (err) {
        console.error("❌ ERRO AO CONECTAR NO POSTGRESQL");
        console.error(err);
    }
})();

/* ==========================================================
   CRIAR TABELA AUTOMATICAMENTE
========================================================== */

(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS produtos (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                quantidade INTEGER DEFAULT 0,
                preco_custo NUMERIC(10,2) DEFAULT 0,
                preco_venda NUMERIC(10,2) DEFAULT 0,
                estoque_minimo INTEGER DEFAULT 0
            )
        `);

        console.log("✅ Tabela produtos pronta");
    } catch (err) {
        console.error("❌ Erro ao criar tabela produtos");
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
                quantidade,
                preco_custo,
                preco_venda,
                estoque_minimo
            )
            VALUES ($1,$2,$3,$4,$5)
            RETURNING *
            `,
            [
                nome,
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
   PORTA RENDER
========================================================== */

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
