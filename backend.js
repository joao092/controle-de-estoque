const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// =========================================================================
// SISTEMA DE VARREDURA RECURSIVA PARA ENCONTRAR O INDEX.HTML
// =========================================================================
function buscarArquivoRecursivo(diretorioAlvo, nomeArquivo) {
    try {
        const arquivos = fs.readdirSync(diretorioAlvo);
        
        for (const arquivo of arquivos) {
            const caminhoCompleto = path.join(diretorioAlvo, arquivo);
            const stats = fs.statSync(caminhoCompleto);
            
            // Ignora a pasta node_modules para não travar o servidor
            if (arquivo === "node_modules" || arquivo === ".git") continue;

            if (stats.isDirectory()) {
                const encontrado = buscarArquivoRecursivo(caminhoCompleto, nomeArquivo);
                if (encontrado) return encontrado;
            } else if (arquivo.toLowerCase() === nomeArquivo.toLowerCase()) {
                return caminhoCompleto;
            }
        }
    } catch (err) {
        console.error("Erro ao ler diretório na busca:", diretorioAlvo, err.message);
    }
    return null;
}

// Inicia a busca a partir do diretório base do projeto no Render
const diretorioRaizRender = "/opt/render/project/src";
let caminhoIndexFinal = buscarArquivoRecursivo(diretorioRaizRender, "index.html");

// Fallback caso o Render mude o diretório padrão
if (!caminhoIndexFinal) {
    caminhoIndexFinal = buscarArquivoRecursivo(process.cwd(), "index.html");
}

if (caminhoIndexFinal) {
    console.log(`\n==================================================`);
    console.log(`🎯 SUCESSO: O arquivo index.html foi localizado em:\n${caminhoIndexFinal}`);
    console.log(`==================================================\n`);
    
    // Configura a pasta onde o index.html está como a pasta de arquivos estáticos
    app.use(express.static(path.dirname(caminhoIndexFinal)));
} else {
    console.log(`\n❌ ERRO CRÍTICO: O arquivo index.html não foi encontrado em NENHUMA pasta do projeto.`);
    // Fallback padrão para evitar crash completo
    caminhoIndexFinal = path.join(__dirname, "index.html");
    app.use(express.static(__dirname));
}
// =========================================================================

// Inicialização do Pool PostgreSQL configurado para o Render
const pool = 
	console.log("DATABASE_URL =", process.env.DATABASE_URL);

	new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: { rejectUnauthorized: false },
});

// Endpoint: Listar todos os produtos do estoque
app.get("/api/produtos", async (req, res) => {
	try {
		const resultado = await pool.query("SELECT * FROM produtos ORDER BY nome ASC");
		return res.status(200).json(resultado.rows);
	} catch (err) {
		console.error("Erro ao listar produtos:", err);
		return res.status(500).json({ erro: "Erro interno no servidor." });
	}
});

// Endpoint: Cadastrar novo produto
app.post("/api/produtos", async (req, res) => {
    console.log("BODY:", req.body);

    const {
        nome,
        quantidade,
        preco_custo,
        preco_venda,
        estoque_minimo
    } = req.body;

    console.log({
        nome,
        quantidade,
        preco_custo,
        preco_venda,
        estoque_minimo
    });

    try {
        const resultado = await pool.query(
            `INSERT INTO produtos
            (nome, quantidade, preco_custo, preco_venda, estoque_minimo)
            VALUES ($1,$2,$3,$4,$5)
            RETURNING *`,
            [nome, quantidade, preco_custo, preco_venda, estoque_minimo]
        );

        res.status(201).json(resultado.rows[0]);

    } catch (err) {
        console.error("ERRO POSTGRES:", err);
        res.status(500).json({
            erro: err.message
        });
    }
});
// Configuração da porta dinâmica do Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
	console.log(`Servidor de controle de estoque rodando na porta ${PORT}`);
});
