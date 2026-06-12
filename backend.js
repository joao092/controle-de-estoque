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
// SCRIPT DE LOCALIZAÇÃO DINÂMICA DO INDEX.HTML (Resolução do erro ENOENT)
// =========================================================================
function encontrarCaminhoDoIndex() {
    // Lista de caminhos prováveis onde o Render pode ter jogado seu arquivo
    const caminhosPossiveis = [
        path.join(__dirname, "index.html"),
        path.join(process.cwd(), "index.html"),
        path.join(__dirname, "..", "index.html"),
        path.join(process.cwd(), "src", "index.html"),
        "/opt/render/project/src/index.html"
    ];

    for (const caminho of caminhosPossiveis) {
        if (fs.existsSync(caminho)) {
            console.log(`[Sucesso] index.html encontrado em: ${caminho}`);
            return caminho;
        }
    }
    
    // Se não achar em nenhum lugar, retorna o __dirname padrão para não quebrar a compilação
    return path.join(__dirname, "index.html");
}

const caminhoIndexFinal = encontrarCaminhoDoIndex();
const pastaEstaticaFinal = path.dirname(caminhoIndexFinal);

// Configura os arquivos estáticos (CSS, JS) baseados na pasta real onde o HTML está
app.use(express.static(pastaEstaticaFinal));
// =========================================================================

// Inicialização do Pool PostgreSQL configurado para o Render
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: { rejectUnauthorized: false }, // Obrigatório para conexões seguras no Render
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
	const { nome, quantidade, preco_custo, preco_venda, estoque_minimo } = req.body;
	try {
		const query = `
			INSERT INTO produtos (nome, quantidade, preco_custo, preco_venda, estoque_minimo) 
			VALUES ($1, $2, $3, $4, $5) RETURNING *`;
		const valores = [nome, quantidade, preco_custo, preco_venda, estoque_minimo];
		const resultado = await pool.query(query, valores);
		
		return res.status(201).json(resultado.rows[0]);
	} catch (err) {
		console.error("Erro ao cadastrar produto:", err);
		return res.status(500).json({ erro: "Erro ao inserir produto no banco." });
	}
});

// Endpoint: Registrar movimentações (Entradas e Saídas)
app.post("/api/movimentacoes", async (req, res) => {
	const { id_produto, tipo, quantidade } = req.body;

	try {
		const prodRes = await pool.query("SELECT quantidade, nome FROM produtos WHERE id_produto = $1", [id_produto]);
		if (prodRes.rows.length === 0) {
			return res.status(404).json({ erro: "Produto não encontrado." });
		}

		const produtoAtual = prodRes.rows[0];
		let novaQuantidade = parseInt(produtoAtual.quantidade);

		if (tipo === "ENTRADA") {
			novaQuantidade += parseInt(quantidade);
		} else if (tipo === "SAIDA") {
			if (novaQuantidade < parseInt(quantidade)) {
				return res.status(400).json({ 
					erro: `Quantidade insuficiente! O produto '${produtoAtual.nome}' possui apenas ${novaQuantidade} unidades em estoque.` 
				});
			}
			novaQuantidade -= parseInt(quantidade);
		} else {
			return res.status(400).json({ erro: "Tipo de operação inválido." });
		}

		await pool.query("UPDATE produtos SET quantidade = $1 WHERE id_produto = $2", [novaQuantidade, id_produto]);

		await pool.query(
			"INSERT INTO movimentacoes (id_produto, tipo, quantidade, data_operacao) VALUES ($1, $2, $3, NOW())",
			[id_produto, tipo, quantidade]
		);

		return res.status(200).json({ mensagem: "Movimentação registrada e estoque atualizado!", novaQuantidade });
	} catch (err) {
		console.error("Erro ao processar movimentação:", err);
		return res.status(500).json({ erro: "Erro ao processar movimentação no banco de dados." });
	}
});

// Rotas principais servindo o arquivo detectado dinamicamente
app.get("/", (req, res) => {
	res.sendFile(caminhoIndexFinal);
});

app.get("*", (req, res) => {
	res.sendFile(caminhoIndexFinal);
});

// Configura a porta dinâmica exigida pelo Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
	console.log(`Servidor de controle de estoque rodando na porta ${PORT}`);
});
