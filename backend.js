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
   CRIAR TABELAS
========================================================== */

(async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS usuarios (
            id_usuario SERIAL PRIMARY KEY,
            nome VARCHAR(100) NOT NULL,
            senha VARCHAR(255) NOT NULL,
            nivel_acesso VARCHAR(20) NOT NULL DEFAULT 'usuario',
            token VARCHAR(255) DEFAULT NULL
        )`);
        console.log("Tabela usuarios criada");

        const colsUser = await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = 'usuarios'`
        );
        const existentesUser = colsUser.rows.map(r => r.column_name);
        const necessariasUser = { nivel_acesso: "VARCHAR(20) DEFAULT 'usuario'" };
        for (const [col, tipo] of Object.entries(necessariasUser)) {
            if (!existentesUser.includes(col)) {
                await pool.query(`ALTER TABLE usuarios ADD COLUMN ${col} ${tipo}`);
            }
        }
    } catch (err) {
        console.error("Erro usuarios:", err.message);
    }
})();

(async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS fornecedores (
            id_fornecedor SERIAL PRIMARY KEY,
            nome VARCHAR(100) NOT NULL,
            contato VARCHAR(50) DEFAULT ''
        )`);
        console.log("Tabela fornecedores criada");
    } catch (err) {
        console.error("Erro fornecedores:", err.message);
    }
})();

(async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS produtos (
            id_produto SERIAL PRIMARY KEY,
            nome VARCHAR(150) NOT NULL,
            categoria VARCHAR(80) DEFAULT '',
            preco_custo NUMERIC(10,2) NOT NULL DEFAULT 0,
            preco_venda NUMERIC(10,2) NOT NULL DEFAULT 0,
            quantidade INTEGER NOT NULL DEFAULT 0,
            estoque_minimo INTEGER NOT NULL DEFAULT 0,
            data_cadastro DATE NOT NULL DEFAULT CURRENT_DATE,
            id_fornecedor INTEGER DEFAULT NULL REFERENCES fornecedores(id_fornecedor) ON DELETE SET NULL
        )`);

        const colsProd = await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = 'produtos'`
        );
        const existentesProd = colsProd.rows.map(r => r.column_name);
        const necessariasProd = { id_fornecedor: "INTEGER DEFAULT NULL REFERENCES fornecedores(id_fornecedor) ON DELETE SET NULL" };
        for (const [col, tipo] of Object.entries(necessariasProd)) {
            if (!existentesProd.includes(col)) {
                await pool.query(`ALTER TABLE produtos ADD COLUMN ${col} ${tipo}`);
            }
        }

        console.log("Tabela produtos criada");
    } catch (err) {
        console.error("Erro produtos:", err.message);
    }
})();

(async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS entradas (
            id_entrada SERIAL PRIMARY KEY,
            id_produto INTEGER NOT NULL REFERENCES produtos(id_produto) ON DELETE RESTRICT,
            id_fornecedor INTEGER DEFAULT NULL REFERENCES fornecedores(id_fornecedor) ON DELETE SET NULL,
            id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
            quantidade INTEGER NOT NULL CHECK (quantidade > 0),
            valor_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
            data_entrada DATE NOT NULL DEFAULT CURRENT_DATE,
            observacao TEXT DEFAULT NULL
        )`);
        console.log("Tabela entradas criada");
    } catch (err) {
        console.error("Erro entradas:", err.message);
    }
})();

(async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS saidas (
            id_saida SERIAL PRIMARY KEY,
            id_produto INTEGER NOT NULL REFERENCES produtos(id_produto) ON DELETE RESTRICT,
            id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
            quantidade INTEGER NOT NULL CHECK (quantidade > 0),
            motivo VARCHAR(50) DEFAULT NULL,
            cliente VARCHAR(150) DEFAULT NULL,
            data_saida DATE NOT NULL DEFAULT CURRENT_DATE,
            observacao TEXT DEFAULT NULL
        )`);
        console.log("Tabela saidas criada");
    } catch (err) {
        console.error("Erro saidas:", err.message);
    }
})();

/* ==========================================================
   TRIGGERS
========================================================== */

(async () => {
    try {
        await pool.query(`
            CREATE OR REPLACE FUNCTION fn_atualiza_estoque_entrada()
            RETURNS TRIGGER AS $$
            BEGIN
                UPDATE produtos SET quantidade = quantidade + NEW.quantidade
                WHERE id_produto = NEW.id_produto;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `);

        await pool.query(`
            DROP TRIGGER IF EXISTS trg_entrada_estoque ON entradas
        `);

        await pool.query(`
            CREATE TRIGGER trg_entrada_estoque
            AFTER INSERT ON entradas
            FOR EACH ROW
            EXECUTE FUNCTION fn_atualiza_estoque_entrada()
        `);

        console.log("Trigger entrada criada");
    } catch (err) {
        console.error("Erro trigger entrada:", err.message);
    }
})();

(async () => {
    try {
        await pool.query(`
            CREATE OR REPLACE FUNCTION fn_atualiza_estoque_saida()
            RETURNS TRIGGER AS $$
            DECLARE qtd_atual INTEGER;
            BEGIN
                SELECT quantidade INTO qtd_atual FROM produtos WHERE id_produto = NEW.id_produto;

                IF qtd_atual < NEW.quantidade THEN
                    RAISE EXCEPTION 'Estoque insuficiente. Disponivel: %, solicitado: %', qtd_atual, NEW.quantidade;
                END IF;

                UPDATE produtos SET quantidade = quantidade - NEW.quantidade
                WHERE id_produto = NEW.id_produto;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `);

        await pool.query(`
            DROP TRIGGER IF EXISTS trg_saida_estoque ON saidas
        `);

        await pool.query(`
            CREATE TRIGGER trg_saida_estoque
            BEFORE INSERT ON saidas
            FOR EACH ROW
            EXECUTE FUNCTION fn_atualiza_estoque_saida()
        `);

        console.log("Trigger saida criada");
    } catch (err) {
        console.error("Erro trigger saida:", err.message);
    }
})();

/* ==========================================================
   VIEWS
========================================================== */

(async () => {
    try {
        await pool.query(`
            CREATE OR REPLACE VIEW vw_estoque_baixo AS
            SELECT id_produto, nome, quantidade AS qtd_atual, estoque_minimo,
                   (estoque_minimo - quantidade) AS deficit
            FROM produtos
            WHERE quantidade <= estoque_minimo
            ORDER BY deficit DESC
        `);

        await pool.query(`
            CREATE OR REPLACE VIEW vw_valor_estoque AS
            SELECT id_produto, nome, quantidade, preco_custo, preco_venda,
                   (quantidade * preco_custo) AS valor_custo_total,
                   (quantidade * preco_venda) AS valor_venda_total
            FROM produtos
            ORDER BY valor_custo_total DESC
        `);

        console.log("Views criadas");
    } catch (err) {
        console.error("Erro views:", err.message);
    }
})();

/* ==========================================================
   INDICES
========================================================== */

(async () => {
    try {
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_produtos_fornecedor ON produtos(id_fornecedor)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_entradas_produto ON entradas(id_produto)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_entradas_data ON entradas(data_entrada)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_saidas_produto ON saidas(id_produto)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_saidas_data ON saidas(data_saida)`);
        console.log("Indices criados");
    } catch (err) {
        console.error("Erro indices:", err.message);
    }
})();

/* ==========================================================
   USUARIO PADRAO
========================================================== */

(async () => {
    try {
        const count = await pool.query("SELECT COUNT(*) FROM usuarios");
        if (parseInt(count.rows[0].count) === 0) {
            const senhaHash = crypto.createHash("sha256").update("admin123").digest("hex");
            await pool.query(
                `INSERT INTO usuarios (nome, senha, nivel_acesso) VALUES ($1, $2, $3)`,
                ["Administrador", senhaHash, "Administrador"]
            );
            console.log("Usuario padrao criado: Administrador / admin123");
        }
    } catch (err) {
        console.error("Erro usuario padrao:", err.message);
    }
})();

/* ==========================================================
   CONFIGURACOES
========================================================== */

(async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS configuracoes (
            id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            dados JSONB DEFAULT '{}',
            preferencias JSONB DEFAULT '{}'
        )`);
        await pool.query(`INSERT INTO configuracoes (id, dados, preferencias) VALUES (1, '{}', '{}') ON CONFLICT (id) DO NOTHING`);
        console.log("Tabela configuracoes criada");
    } catch (err) {
        console.error("Erro configuracoes:", err.message);
    }
})();

/* ==========================================================
   ROTA PRINCIPAL
========================================================== */

app.get("/", (req, res) => {
    res.sendFile(caminhoIndexFinal);
});

/* ==========================================================
   LOGIN
========================================================== */

app.post("/api/login", async (req, res) => {
    try {
        const { nome, senha } = req.body;
        const senhaHash = crypto.createHash("sha256").update(senha).digest("hex");

        const result = await pool.query(
            "SELECT id_usuario, nome, nivel_acesso FROM usuarios WHERE nome = $1 AND senha = $2",
            [nome, senhaHash]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ erro: "Nome ou senha incorretos" });
        }

        const usuario = result.rows[0];
        const token = crypto.randomBytes(32).toString("hex");

        await pool.query("UPDATE usuarios SET token = $1 WHERE id_usuario = $2", [token, usuario.id_usuario]);

        return res.json({
            usuario: { id: usuario.id_usuario, nome: usuario.nome, nivel_acesso: usuario.nivel_acesso },
            token
        });
    } catch (err) {
        console.error("ERRO LOGIN:", err.message);
        return res.status(500).json({ erro: err.message });
    }
});

app.get("/api/sessao", async (req, res) => {
    try {
        const token = req.headers.authorization;
        if (!token) return res.json({ autenticado: false });

        const result = await pool.query(
            "SELECT id_usuario, nome, nivel_acesso FROM usuarios WHERE token = $1", [token]
        );

        if (result.rows.length === 0) return res.json({ autenticado: false });

        return res.json({ autenticado: true, usuario: result.rows[0] });
    } catch (err) {
        console.error("ERRO SESSAO:", err.message);
        return res.status(500).json({ erro: err.message });
    }
});

app.post("/api/logout", async (req, res) => {
    try {
        const token = req.headers.authorization;
        if (token) await pool.query("UPDATE usuarios SET token = NULL WHERE token = $1", [token]);
        return res.json({ mensagem: "Sessao encerrada" });
    } catch (err) {
        console.error("ERRO LOGOUT:", err.message);
        return res.status(500).json({ erro: err.message });
    }
});

/* ==========================================================
   PRODUTOS
========================================================== */

app.get("/api/produtos", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, f.nome AS fornecedor_nome
            FROM produtos p
            LEFT JOIN fornecedores f ON f.id_fornecedor = p.id_fornecedor
            ORDER BY p.nome ASC
        `);
        return res.json(result.rows);
    } catch (err) {
        console.error("ERRO GET PRODUTOS:", err.message);
        return res.status(500).json({ erro: err.message });
    }
});

app.post("/api/produtos", async (req, res) => {
    try {
        const { nome, categoria, preco_custo, preco_venda, quantidade, estoque_minimo, id_fornecedor } = req.body;
        const result = await pool.query(
            `INSERT INTO produtos (nome, categoria, preco_custo, preco_venda, quantidade, estoque_minimo, id_fornecedor)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [nome, categoria||'', preco_custo, preco_venda, quantidade, estoque_minimo, id_fornecedor||null]
        );
        return res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("ERRO INSERT PRODUTO:", err.message);
        return res.status(500).json({ erro: err.message });
    }
});

/* ==========================================================
   ENTRADAS
========================================================== */

app.get("/api/entradas", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT e.*, p.nome AS produto_nome, u.nome AS usuario_nome
            FROM entradas e
            JOIN produtos p ON p.id_produto = e.id_produto
            JOIN usuarios u ON u.id_usuario = e.id_usuario
            ORDER BY e.data_entrada DESC, e.id_entrada DESC
        `);
        return res.json(result.rows);
    } catch (err) {
        console.error("ERRO GET ENTRADAS:", err.message);
        return res.status(500).json({ erro: err.message });
    }
});

app.post("/api/entradas", async (req, res) => {
    try {
        const { id_produto, id_fornecedor, id_usuario, quantidade, valor_unitario, data_entrada, observacao } = req.body;
        const result = await pool.query(
            `INSERT INTO entradas (id_produto, id_fornecedor, id_usuario, quantidade, valor_unitario, data_entrada, observacao)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [id_produto, id_fornecedor||null, id_usuario, quantidade, valor_unitario||0, data_entrada, observacao||null]
        );
        return res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("ERRO INSERT ENTRADA:", err.message);
        return res.status(500).json({ erro: err.message });
    }
});

/* ==========================================================
   SAIDAS
========================================================== */

app.get("/api/saidas", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT s.*, p.nome AS produto_nome, u.nome AS usuario_nome
            FROM saidas s
            JOIN produtos p ON p.id_produto = s.id_produto
            JOIN usuarios u ON u.id_usuario = s.id_usuario
            ORDER BY s.data_saida DESC, s.id_saida DESC
        `);
        return res.json(result.rows);
    } catch (err) {
        console.error("ERRO GET SAIDAS:", err.message);
        return res.status(500).json({ erro: err.message });
    }
});

app.post("/api/saidas", async (req, res) => {
    try {
        const { id_produto, id_usuario, quantidade, motivo, cliente, data_saida, observacao } = req.body;
        const result = await pool.query(
            `INSERT INTO saidas (id_produto, id_usuario, quantidade, motivo, cliente, data_saida, observacao)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [id_produto, id_usuario, quantidade, motivo||null, cliente||null, data_saida, observacao||null]
        );
        return res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.message && err.message.includes("Estoque insuficiente")) {
            return res.status(400).json({ erro: err.message });
        }
        console.error("ERRO INSERT SAIDA:", err.message);
        return res.status(500).json({ erro: err.message });
    }
});

/* ==========================================================
   FORNECEDORES
========================================================== */

app.get("/api/fornecedores", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM fornecedores ORDER BY nome ASC");
        return res.json(result.rows);
    } catch (err) {
        console.error("ERRO GET FORNECEDORES:", err.message);
        return res.status(500).json({ erro: err.message });
    }
});

app.post("/api/fornecedores", async (req, res) => {
    try {
        const { nome, contato } = req.body;
        const result = await pool.query(
            "INSERT INTO fornecedores (nome, contato) VALUES ($1,$2) RETURNING *",
            [nome, contato||'']
        );
        return res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("ERRO INSERT FORNECEDOR:", err.message);
        return res.status(500).json({ erro: err.message });
    }
});

app.delete("/api/fornecedores/:id", async (req, res) => {
    try {
        await pool.query("DELETE FROM fornecedores WHERE id_fornecedor = $1", [req.params.id]);
        return res.json({ mensagem: "Fornecedor removido" });
    } catch (err) {
        console.error("ERRO DELETE FORNECEDOR:", err.message);
        return res.status(500).json({ erro: err.message });
    }
});

/* ==========================================================
   RELATORIOS
========================================================== */

app.get("/api/relatorios/estoque-baixo", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM vw_estoque_baixo");
        return res.json(result.rows);
    } catch (err) {
        console.error("ERRO VW ESTOQUE BAIXO:", err.message);
        return res.status(500).json({ erro: err.message });
    }
});

app.get("/api/relatorios/valor-estoque", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM vw_valor_estoque");
        return res.json(result.rows);
    } catch (err) {
        console.error("ERRO VW VALOR ESTOQUE:", err.message);
        return res.status(500).json({ erro: err.message });
    }
});

app.get("/api/relatorios/movimentacoes", async (req, res) => {
    try {
        const entradas = await pool.query(`
            SELECT e.id_entrada AS id, 'ENTRADA' AS tipo, e.id_produto, p.nome AS produto_nome,
                   e.quantidade, e.valor_unitario, e.data_entrada AS data_mov, e.id_usuario, u.nome AS usuario_nome
            FROM entradas e
            JOIN produtos p ON p.id_produto = e.id_produto
            JOIN usuarios u ON u.id_usuario = e.id_usuario
        `);

        const saidas = await pool.query(`
            SELECT s.id_saida AS id, 'SAIDA' AS tipo, s.id_produto, p.nome AS produto_nome,
                   s.quantidade, 0 AS valor_unitario, s.data_saida AS data_mov, s.id_usuario, u.nome AS usuario_nome
            FROM saidas s
            JOIN produtos p ON p.id_produto = s.id_produto
            JOIN usuarios u ON u.id_usuario = s.id_usuario
        `);

        const movs = [...entradas.rows, ...saidas.rows];
        movs.sort((a, b) => new Date(b.data_mov) - new Date(a.data_mov));

        return res.json(movs);
    } catch (err) {
        console.error("ERRO MOVIMENTACOES:", err.message);
        return res.status(500).json({ erro: err.message });
    }
});

app.get("/api/relatorios/mais-vendidos", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT s.id_produto, p.nome, SUM(s.quantidade) AS total_vendido
            FROM saidas s
            JOIN produtos p ON p.id_produto = s.id_produto
            GROUP BY s.id_produto, p.nome
            ORDER BY total_vendido DESC
            LIMIT 10
        `);
        return res.json(result.rows);
    } catch (err) {
        console.error("ERRO MAIS VENDIDOS:", err.message);
        return res.status(500).json({ erro: err.message });
    }
});

/* ==========================================================
   CONFIGURACOES
========================================================== */

app.get("/api/configuracoes", async (req, res) => {
    try {
        const result = await pool.query("SELECT dados, preferencias FROM configuracoes WHERE id = 1");
        if (result.rows.length === 0) return res.json({ dados: {}, preferencias: {} });
        return res.json(result.rows[0]);
    } catch (err) {
        console.error("ERRO GET CONFIG:", err.message);
        return res.status(500).json({ erro: err.message });
    }
});

app.put("/api/configuracoes", async (req, res) => {
    try {
        const { dados, preferencias } = req.body;
        const result = await pool.query(
            `UPDATE configuracoes SET dados = COALESCE($1::jsonb, dados), preferencias = COALESCE($2::jsonb, preferencias) WHERE id = 1 RETURNING dados, preferencias`,
            [dados ? JSON.stringify(dados) : null, preferencias ? JSON.stringify(preferencias) : null]
        );
        return res.json(result.rows[0]);
    } catch (err) {
        console.error("ERRO PUT CONFIG:", err.message);
        return res.status(500).json({ erro: err.message });
    }
});

/* ==========================================================
   PORTA RENDER
========================================================== */

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
