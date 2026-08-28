// ============================================================================
// CÓDIGO COMPLETO FINAL & INTEGRADO (RODÍZIO DE ADM + PIX EM JSON + FILAS MISTAS)
// ============================================================================

const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionsBitField, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const http = require('http');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('SAMURAI E-SPORTS bot rodando normal e ativo!\n');
});

server.listen(PORT, () => {
    console.log(`Servidor HTTP ouvindo na porta ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const filas = new Map();
const confirmadosPartida = new Map();
const CARGO_SUPORTE_ID = '1541235665960833145';

let filaMediadores = [];
let pixConfig = {};

// ==========================================
// PERSISTÊNCIA DO PIX EM JSON
// ==========================================
const pixFile = path.join(__dirname, 'pixConfig.json');
if (fs.existsSync(pixFile)) {
    try {
        pixConfig = JSON.parse(fs.readFileSync(pixFile, 'utf8'));
    } catch (e) {
        pixConfig = {};
    }
}

function salvarPix() {
    fs.writeFileSync(pixFile, JSON.stringify(pixConfig, null, 2));
}

const limitesFila = {
    '1x1': 2,
    '2x2': 4,
    '3x3': 6,
    '4x4': 8
};

const filasMistas = {
    '2x2-misto': { formato: '2x2 Misto', valor: 5.00, maxTotal: 2, emus: [] },
    '3x3-misto': { formato: '3x3 Misto', valor: 5.00, maxTotal: 2, emus: [] },
    '4x4-misto': { formato: '4x4 Misto', valor: 5.00, maxTotal: 2, emus: [] }
};

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

client.once('ready', () => {
    console.log(`Bot online como: ${client.user.tag}`);
});

// ==========================================
// FUNÇÃO DE RODÍZIO DE ADM AUTOMÁTICO (FILAS NORMAIS & MISTAS)
// ==========================================
async function puxarProximoMediador(guild, jogadoresPartida, tipoModo, valorAposta, canalOrigem) {
    if (filaMediadores.length === 0) {
        try {
            await canalOrigem.send({ 
                content: `⚠️ A fila de **${tipoModo.toUpperCase()} (${formatarMoeda(valorAposta)})** encheu, mas **não há nenhum mediador na fila de mediadores!** Entrem na fila usando \`!mediador\`.` 
            });
        } catch (err) {}
        return;
    }

    // Pega o primeiro da fila (rodízio) e joga para o final (reinicia o ciclo)
    const admId = filaMediadores.shift();
    filaMediadores.push(admId);

    try {
        const categoriaDestino = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory);
        const numPartida = Math.floor(Math.random() * 900000 + 100000);

        const canalPrivado = await guild.channels.create({
            name: `sala-${tipoModo}`.toLowerCase().replace(/\s/g, '-'),
            type: ChannelType.GuildText,
            parent: categoriaDestino ? categoriaDestino.id : canalOrigem.parentId,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                ...jogadoresPartida.map(pId => ({
                    id: typeof pId === 'object' ? pId.id : pId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                })),
                { id: admId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
            ]
        });

        confirmadosPartida.set(canalPrivado.id, []);
        const medConfig = pixConfig[admId] || { chave: 'Não configurada', nome: 'Não configurado' };
        const taxaAdm = 0.15;
        const listaFormatadaJogadores = jogadoresPartida.map(p => typeof p === 'object' ? `<@${p.id}>` : `<@${p}>`).join(', ');
        const primeiroJogadorId = typeof jogadoresPartida[0] === 'object' ? jogadoresPartida[0].id : jogadoresPartida[0];

        const embedApostaCriada = new EmbedBuilder()
            .setColor('#0099ff')
            .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
            .setTitle('SAMURAI E-SPORTS | Canal de Aposta ✅')
            .addFields(
                { name: 'Partida:', value: `${numPartida}`, inline: false },
                { name: 'Modo:', value: `${tipoModo.toUpperCase()}`, inline: false },
                { name: 'Valor da Aposta:', value: `${formatarMoeda(valorAposta)}`, inline: false },
                { name: 'Taxa ADM:', value: `${formatarMoeda(taxaAdm)}`, inline: false },
                { name: 'Jogadores:', value: `${listaFormatadaJogadores}`, inline: false },
                { name: 'Mediador (Vez):', value: `<@${admId}>`, inline: false },
                { name: 'Chave Pix:', value: `\`${medConfig.chave}\``, inline: false },
                { name: 'Nome completo:', value: `\`${medConfig.nome}\``, inline: false }
            );

        const botoesApostaCriada = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`confirmar_${primeiroJogadorId}_${valorAposta}_${admId}`).setLabel('Confirmar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cancelar_aposta').setLabel('Cancelar').setStyle(ButtonStyle.Danger)
        );

        await canalPrivado.send({
            content: `${jogadoresPartida.map(p => typeof p === 'object' ? `<@${p.id}>` : `<@${p}>`).join(' ')} <@${admId}>`,
            embeds: [embedApostaCriada],
            components: [botoesApostaCriada]
        });

    } catch (e) {
        console.log("Erro ao criar canal privado automático:", e);
    }
}

// ==========================================
// ATUALIZADOR DO PAINEL DE MEDIADORES
// ==========================================
async function atualizarPainelMediadoresPorMensagem(message) {
    let statusTexto = 'Nenhum mediador na fila no momento.';
    if (filaMediadores.length > 0) {
        statusTexto = filaMediadores.map((id, index) => `${index + 1}º - <@${id}>`).join('\n');
    }

    const embedAtualizado = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('⚔️ SAMURAI E-SPORTS | FILA DE MEDIADORES')
        .setDescription('Clique em **Entrar na Fila** para assumir uma partida ou em **Sair da Fila** caso precise sair.')
        .addFields({ name: 'Status da Fila', value: statusTexto, inline: false })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_entrar_fila').setLabel('Entrar na Fila').setStyle(ButtonStyle.Success).setEmoji('✅'),
        new ButtonBuilder().setCustomId('btn_sair_fila').setLabel('Sair da Fila').setStyle(ButtonStyle.Danger).setEmoji('❌'),
        new ButtonBuilder().setCustomId('btn_atualizar_fila').setLabel('Atualizar').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
        new ButtonBuilder().setCustomId('btn_reset_fila').setLabel('Reset').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
    );

    try {
        await message.edit({ embeds: [embedAtualizado], components: [row] });
    } catch (e) {
        console.log("Erro ao atualizar painel de mediadores:", e);
    }
}

function criarBotoesMisto(chaveFila) {
    const linha = new ActionRowBuilder();

    if (chaveFila === '2x2-misto') {
        linha.addComponents(new ButtonBuilder().setCustomId(`${chaveFila}_emu_1`).setLabel('1º Emu').setStyle(ButtonStyle.Secondary));
    } else if (chaveFila === '3x3-misto') {
        linha.addComponents(
            new ButtonBuilder().setCustomId(`${chaveFila}_emu_1`).setLabel('1º Emu').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`${chaveFila}_emu_2`).setLabel('2º Emu').setStyle(ButtonStyle.Secondary)
        );
    } else if (chaveFila === '4x4-misto') {
        linha.addComponents(
            new ButtonBuilder().setCustomId(`${chaveFila}_emu_1`).setLabel('1º Emu').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`${chaveFila}_emu_2`).setLabel('2º Emu').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`${chaveFila}_emu_3`).setLabel('3º Emu').setStyle(ButtonStyle.Secondary)
        );
    }

    linha.addComponents(new ButtonBuilder().setCustomId(`${chaveFila}_sair`).setLabel('Sair da fila').setStyle(ButtonStyle.Danger));
    return linha;
}

async function atualizarPainelMisto(interaction, chaveFila) {
    try {
        const fila = filasMistas[chaveFila];
        const mensagem = interaction.message;
        const taxaAdm = 0.15;

        let listaTexto = `Nenhum jogador na fila`;
        if (fila.emus.length > 0) {
            listaTexto = fila.emus.map(id => `<@${id}> | ${fila.emus.indexOf(id) + 1} Emu`).join('\n');
        }

        const embedAtualizada = new EmbedBuilder()
            .setTitle(`${fila.formato} | SAMURAI E-SPORTS`)
            .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
            .setDescription(`🎮 Modo:\n${fila.formato}\n\n💰 Aposta:\n${formatarMoeda(fila.valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👤 Jogadores:\n${listaTexto}`)
            .setColor('#0099ff');

        const linhaBotoes = criarBotoesMisto(chaveFila);
        await mensagem.edit({ embeds: [embedAtualizada], components: [linhaBotoes] });
    } catch (err) {
        console.error('Erro ao atualizar painel misto:', err);
    }
}

// ==========================================
// MENSAGENS (COMANDOS)
// ==========================================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!limpar')) {
        try {
            await message.delete().catch(() => {});
            const fetched = await message.channel.messages.fetch({ limit: 50 });
            for (const msg of fetched.values()) {
                await msg.delete().catch(() => {});
            }
        } catch (e) {
            console.log("Erro ao limpar mensagens:", e);
        }
        return;
    }

    if (message.content.startsWith('!ticket')) {
        await message.delete().catch(() => {});

        const embedTicket = new EmbedBuilder()
            .setTitle('SAMURAI E-SPORTS | Central de Atendimento 🎫')
            .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
            .setDescription('📂 Seja bem-vindo(a) ao sistema de atendimento! Aqui você pode abrir um ticket de forma rápida e organizada.\n\n👇 **Selecione uma das opções no menu abaixo para iniciar seu atendimento e aguarde que nossa equipe irá te responder o mais breve possível.**')
            .setColor('#0099ff');

        const menuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('criar_ticket')
                .setPlaceholder('Selecione o ticket que deseja abrir')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Suporte').setDescription('Auxílio, ajudas, dúvidas e propostas...').setValue('suporte').setEmoji('💬'),
                    new StringSelectMenuOptionBuilder().setLabel('Reembolso').setDescription('Adm pagou errado, sumiu e precisa de reembolso.').setValue('reembolso').setEmoji('💳'),
                    new StringSelectMenuOptionBuilder().setLabel('Seja Mediador').setDescription('Abra ticket aqui para fazer parte da equipe.').setValue('seja_mediador').setEmoji('🛡️'),
                    new StringSelectMenuOptionBuilder().setLabel('Divulgação').setDescription('Caso queira uma divulgação.').setValue('divulgacao').setEmoji('📢')
                )
        );

        await message.channel.send({ embeds: [embedTicket], components: [menuRow] });
        return;
    }

    if (message.content.startsWith('!postar')) {
        const args = message.content.trim().split(/\s+/);
        if (args.length < 3) {
            return message.reply('Use o formato correto com espaço: `!postar 1x1 2.00`');
        }

        const tipoModo = args[1];
        const valor = parseFloat(args[2].replace(',', '.'));

        if (isNaN(valor)) {
            return message.reply('❌ Por favor, insira um valor numérico válido, ex: `!postar 1x1 2.00`');
        }

        await message.delete().catch(() => {});
        const taxaAdm = 0.15;
        const maxJogadores = limitesFila[tipoModo.toLowerCase()] || 2;

        const embed = new EmbedBuilder()
            .setTitle(`${tipoModo.toUpperCase()} | SAMURAI E-SPORTS`)
            .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
            .setDescription(`🎮 Modo: ${tipoModo}\n💰 Aposta:\n${formatarMoeda(valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👥 **Jogadores na Fila (0/${maxJogadores})**`)
            .setColor('#0099ff');

        const botoes = new ActionRowBuilder();

        if (tipoModo.toLowerCase().includes('1x1')) {
            botoes.addComponents(
                new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Gelo Normal`).setLabel('Gelo Normal').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Gelo Infinito`).setLabel('Gelo Infinito').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`sair|${tipoModo}|${valor}|Sair`).setLabel('Sair').setStyle(ButtonStyle.Secondary)
            );
        } else {
            botoes.addComponents(
                new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Normal`).setLabel('NORMAL').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Full Ump Xm8`).setLabel('FULL UMP XM8').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`sair|${tipoModo}|${valor}|Sair`).setLabel('Sair').setStyle(ButtonStyle.Secondary)
            );
        }

        await message.channel.send({ embeds: [embed], components: [botoes] });
        return;
    }

    if (message.content.startsWith('!painel')) {
        const argumentos = message.content.split(' ');
        const tipo = argumentos[1];
        const valorArg = parseFloat((argumentos[2] || '5.00').replace(',', '.'));

        if (!filasMistas[tipo]) {
            return message.reply('❌ Tipo inválido. Use: `!painel 2x2-misto 5.00`, `!painel 3x3-misto 5.00` ou `!painel 4x4-misto 5.00`.');
        }

        const configuracao = filasMistas[tipo];
        configuracao.valor = isNaN(valorArg) ? 5.00 : valorArg;
        const taxaAdm = 0.15;

        const embedPainel = new EmbedBuilder()
            .setTitle(`${configuracao.formato} | SAMURAI E-SPORTS`)
            .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
            .setDescription(`🎮 Modo:\n${configuracao.formato}\n\n💰 Aposta:\n${formatarMoeda(configuracao.valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👤 Jogadores:\nNenhum jogador na fila`)
            .setColor('#0099ff');

        const linhaBotoes = criarBotoesMisto(tipo);

        await message.channel.send({ embeds: [embedPainel], components: [linhaBotoes] });
        await message.delete().catch(() => {});
        return;
    }

    if (message.content.toLowerCase() === '!mediador') {
        const embed = new EmbedBuilder()
            .setTitle('⚔️ SAMURAI E-SPORTS | FILA DE MEDIADORES')
            .setDescription('Clique em **Entrar na Fila** para assumir uma partida ou em **Sair da Fila** caso precise sair.')
            .addFields({ name: 'Status da Fila', value: 'Nenhum mediador na fila no momento.', inline: false })
            .setColor('#FF0000');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_entrar_fila').setLabel('Entrar na Fila').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId('btn_sair_fila').setLabel('Sair da Fila').setStyle(ButtonStyle.Danger).setEmoji('❌'),
            new ButtonBuilder().setCustomId('btn_atualizar_fila').setLabel('Atualizar').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
            new ButtonBuilder().setCustomId('btn_reset_fila').setLabel('Reset').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete().catch(() => {});
        return;
    }

    if (message.content.toLowerCase() === '!pix') {
        const embed = new EmbedBuilder()
            .setTitle('⚡ Configuração de Pix & Mediação')
            .setDescription('Clique no botão abaixo para configurar sua **Chave Pix**, **Nome do Titular** e **Mensagem de Pré-Pagamento**.')
            .setColor('#FF0000');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_config_pix').setLabel('Configurar Pix').setStyle(ButtonStyle.Primary).setEmoji('💳'),
            new ButtonBuilder().setCustomId('btn_ver_qrcode').setLabel('Ver QR-Code').setStyle(ButtonStyle.Secondary).setEmoji('📷'),
            new ButtonBuilder().setCustomId('btn_testar_pix').setLabel('Testar Pix').setStyle(ButtonStyle.Success).setEmoji('🧪')
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete().catch(() => {});
        return;
    }
});

// ==========================================
// INTERAÇÕES (BOTÕES, MODAIS, TICKETS, FILAS)
// ==========================================
client.on('interactionCreate', async (interaction) => {
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_config_pix') {
            const chave = interaction.fields.getTextInputValue('input_chave_pix');
            const nome = interaction.fields.getTextInputValue('input_nome_pix');
            const mensagem = interaction.fields.getTextInputValue('input_msg_pix');

            pixConfig[interaction.user.id] = { chave, nome, mensagem };
            salvarPix();

            await interaction.reply({
                content: `✅ **Configuração salva com sucesso!**\n\n🔑 **Chave:** \`${chave}\`\n👤 **Nome:** ${nome}\n📝 **Mensagem:** ${mensagem || 'Nenhuma'}`,
                ephemeral: true
            });
            return;
        }
    }

    if (interaction.isButton()) {
        const { customId, user, message } = interaction;

        if (customId === 'btn_config_pix') {
            const modal = new ModalBuilder()
                .setCustomId('modal_config_pix')
                .setTitle('Configuração de Mediação');

            const chaveInput = new TextInputBuilder()
                .setCustomId('input_chave_pix')
                .setLabel('Chave Pix')
                .setPlaceholder('Insira a sua chave pix...')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const nomeInput = new TextInputBuilder()
                .setCustomId('input_nome_pix')
                .setLabel('Nome da Chave Pix')
                .setPlaceholder('Insira o nome da chave pix.')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const msgInput = new TextInputBuilder()
                .setCustomId('input_msg_pix')
                .setLabel('Mensagem de Pré-Pagamento')
                .setPlaceholder('Ex: NÃO ACEITO INTER, PICPAY...')
                .setValue('NÃO ACEITOS: INTER, PICPAY, MERCADO PAGO.')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false);
            
            modal.addComponents(
                new ActionRowBuilder().addComponents(chaveInput),
                new ActionRowBuilder().addComponents(nomeInput),
                new ActionRowBuilder().addComponents(msgInput)
            );

            await interaction.showModal(modal);
            return;
        }

        if (customId === 'btn_ver_qrcode') {
            const config = pixConfig[user.id];
            if (!config) {
                return interaction.reply({ content: '❌ Você ainda não configurou sua chave Pix! Clique em "Configurar Pix".', ephemeral: true });
            }

            try {
                const qrBuffer = await qrcode.toBuffer(config.chave);
                await interaction.reply({
                    content: `📷 **QR Code da Chave:** \`${config.chave}\`\n👤 **Titular:** ${config.nome}`,
                    files: [{ attachment: qrBuffer, name: 'qrcode.png' }],
                    ephemeral: true
                });
            } catch (err) {
                await interaction.reply({ content: '❌ Erro ao gerar o QR Code.', ephemeral: true });
            }
            return;
        }

        if (customId === 'btn_testar_pix') {
            const config = pixConfig[user.id];
            if (!config) {
                return interaction.reply({ content: '❌ Configure seu Pix primeiro antes de testar!', ephemeral: true });
            }

            try {
                const qrBuffer = await qrcode.toBuffer(config.chave);
                const testEmbed = new EmbedBuilder()
                    .setTitle('💳 Painel de Pagamento (Teste)')
                    .setDescription(`**Mediador:** <@${user.id}>\n**Chave Pix:** \`${config.chave}\`\n**Titular:** ${config.nome}\n\n**Aviso:** ${config.mensagem || 'Nenhuma restrição informada.'}`)
                    .setColor('#FF0000');

                await interaction.reply({
                    content: '🧪 Pré-visualização do painel:',
                    embeds: [testEmbed],
                    files: [{ attachment: qrBuffer, name: 'qrcode.png' }],
                    ephemeral: true
                });
            } catch (err) {
                await interaction.reply({ content: '❌ Erro ao gerar o teste do Pix.', ephemeral: true });
            }
            return;
        }

        if (customId === 'btn_entrar_fila') {
            if (!filaMediadores.includes(user.id)) {
                filaMediadores.push(user.id);
            }
            await atualizarPainelMediadoresPorMensagem(message);
            return interaction.reply({ content: '✅ Você entrou na fila de mediadores!', ephemeral: true });
        }

        if (customId === 'btn_sair_fila') {
            filaMediadores = filaMediadores.filter(id => id !== user.id);
            await atualizarPainelMediadoresPorMensagem(message);
            return interaction.reply({ content: '❌ Você saiu da fila de mediadores.', ephemeral: true });
        }

        if (customId === 'btn_atualizar_fila') {
            await atualizarPainelMediadoresPorMensagem(message);
            return interaction.reply({ content: '🔄 Fila atualizada com sucesso!', ephemeral: true });
        }

        if (customId === 'btn_reset_fila') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Apenas administradores podem resetar a fila!', ephemeral: true });
            }
            filaMediadores = [];
            await atualizarPainelMediadoresPorMensagem(message);
            return interaction.reply({ content: '⚙️ Fila de mediadores resetada com sucesso.', ephemeral: true });
        }

        if (customId === 'fechar_ticket') {
            if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => {});
            await interaction.followUp({ content: '🔒 Este ticket será fechado em 3 segundos...', ephemeral: true }).catch(() => {});
            setTimeout(async () => {
                await interaction.channel.delete().catch(() => {});
            }, 3000);
            return;
        }

        if (customId === 'cancelar_aposta') {
            if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => {});
            await interaction.followUp({ content: '❌ Aposta cancelada.', ephemeral: true }).catch(() => {});
            setTimeout(async () => {
                await interaction.channel.delete().catch(() => {});
            }, 3000);
            return;
        }

        const partesCustomId = customId.split('_');
        if (partesCustomId[0] === 'confirmar') {
            if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => {});
            const valorAposta = parseFloat(partesCustomId[2]);
            const taxaAdm = 0.15;
            const admId = partesCustomId[3];
            const canalId = interaction.channel.id;

            let listaConfirmados = confirmadosPartida.get(canalId) || [];
            if (listaConfirmados.includes(user.id)) {
                return interaction.followUp({ content: '⚠️ Você já confirmou esta partida!', ephemeral: true }).catch(() => {});
            }

            listaConfirmados.push(user.id);
            confirmadosPartida.set(canalId, listaConfirmados);

            const medConfig = pixConfig[admId] || { chave: "Não configurada", nome: "Não configurado" };

            const embedPagamento = new EmbedBuilder()
                .setColor('#00FF00')
                .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
                .setTitle('SAMURAI E-SPORTS | Pagamento Liberado 💳')
                .addFields(
                    { name: 'Valor da Aposta:', value: `${formatarMoeda(valorAposta)}`, inline: false },
                    { name: 'Taxa do ADM:', value: `${formatarMoeda(taxaAdm)}`, inline: false },
                    { name: 'Mediador responsável:', value: `<@${admId}>`, inline: false },
                    { name: 'Chave Pix:', value: `\`${medConfig.chave}\``, inline: false },
                    { name: 'Nome completo:', value: `${medConfig.nome}`, inline: false }
                );

            await interaction.message.edit({
                content: `🔒 **PARTIDA CONFIRMADA!**`,
                embeds: [embedPagamento],
                components: []
            }).catch(() => {});
            return;
        }

        let chaveFilaMista = customId.split('_')[0];
        if (filasMistas[chaveFilaMista]) {
            if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => {});
            const fila = filasMistas[chaveFilaMista];
            const partes = customId.split('_');
            const acao = partes[1]; 

            if (acao === 'emu') {
                if (fila.emus.includes(user.id)) {
                    return interaction.followUp({ content: '❌ Você já está nesta fila!', ephemeral: true });
                }
                if (fila.emus.length >= fila.maxTotal) {
                    return interaction.followUp({ content: '❌ As vagas já estão esgotadas!', ephemeral: true });
                }

                fila.emus.push(user.id);
                await interaction.followUp({ content: `✅ Vaga garantida!`, ephemeral: true });
                await atualizarPainelMisto(interaction, chaveFilaMista);

                if (fila.emus.length >= fila.maxTotal) {
                    const jogadoresPartida = [...fila.emus];
                    fila.emus = []; // Reseta a fila mista

                    const taxaAdm = 0.15;
                    const embedVazio = new EmbedBuilder()
                        .setTitle(`${fila.formato} | SAMURAI E-SPORTS`)
                        .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
                        .setDescription(`🎮 Modo:\n${fila.formato}\n\n💰 Aposta:\n${formatarMoeda(fila.valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👤 Jogadores:\nNenhum jogador na fila`)
                        .setColor('#0099ff');

                    const linhaBotoes = criarBotoesMisto(chaveFilaMista);
                    await message.edit({ embeds: [embedVazio], components: [linhaBotoes] }).catch(() => {});

                    // CHAMA O RODÍZIO DE ADM PARA A FILA MISTA
                    await puxarProximoMediador(interaction.guild, jogadoresPartida, fila.formato, fila.valor, interaction.channel);
                }

            } else if (acao === 'sair') {
                if (!fila.emus.includes(user.id)) {
                    return interaction.followUp({ content: '⚠️ Você não está nesta fila.', ephemeral: true });
                }
                fila.emus = fila.emus.filter(id => id !== user.id);
                await interaction.followUp({ content: '🚪 Você saiu da fila.', ephemeral: true });
                await atualizarPainelMisto(interaction, chaveFilaMista);
            }
            return;
        }

        if (customId.includes('|')) {
            if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => {});
    
            const partes = customId.split('|');
            if (partes.length < 4) return;

            const [acao, modo, valorStr, opcaoEscolhida] = partes;
            const valor = parseFloat(valorStr);
            const taxaAdm = 0.15;
            const chaveFila = `${message.id}`;
            const maxJogadores = limitesFila[modo.toLowerCase()] || 2;

            if (!filas.has(chaveFila)) filas.set(chaveFila, []);
            let listaJogadores = filas.get(chaveFila);

            if (acao === 'entrar') {
                if (listaJogadores.some(j => j.id === user.id)) {
                    return interaction.followUp({ content: '❌ Você já está nesta fila!', ephemeral: true }).catch(() => {});
                }
                listaJogadores.push({ id: user.id, opcao: opcaoEscolhida });
            } else if (acao === 'sair') {
                const index = listaJogadores.findIndex(j => j.id === user.id);
                if (index !== -1) {
                    listaJogadores.splice(index, 1);
                } else {
                    return interaction.followUp({ content: '❌ Você não está nesta fila!', ephemeral: true }).catch(() => {});
                }
            }

            let textoJogadores = `👥 **Jogadores na Fila (0/${maxJogadores})**`;
            if (listaJogadores.length > 0) {
                textoJogadores = `👥 **Jogadores na Fila (${listaJogadores.length}/${maxJogadores}):**\n` + 
                    listaJogadores.map(j => `<@${j.id}> | ${j.opcao}`).join('\n');
            }

            const novoEmbed = new EmbedBuilder()
                .setTitle(`${modo.toUpperCase()} | SAMURAI E-SPORTS`)
                .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
                .setDescription(`🎮 Modo: ${modo}\n💰 Aposta:\n${formatarMoeda(valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n${textoJogadores}`)
                .setColor('#0099ff');

            await message.edit({ embeds: [novoEmbed] }).catch(() => {});

            if (listaJogadores.length >= maxJogadores) {
                const jogadoresPartida = [...listaJogadores];
                filas.set(chaveFila, []);

                const embedVazio = new EmbedBuilder()
                    .setTitle(`${modo.toUpperCase()} | SAMURAI E-SPORTS`)
                    .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
                    .setDescription(`🎮 Modo: ${modo}\n💰 Aposta:\n${formatarMoeda(valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👥 **Jogadores na Fila (0/${maxJogadores})**`)
                    .setColor('#0099ff');

                await message.edit({ embeds: [embedVazio] }).catch(() => {});

                // CHAMA O RODÍZIO DE ADM AUTOMÁTICO
                await puxarProximoMediador(interaction.guild, jogadoresPartida, modo, valor, interaction.channel);
            }
            return;
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'criar_ticket') {
        if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => {});

        const tipoTicket = interaction.values[0];
        const guild = interaction.guild;
        const usuario = interaction.user;

        try {
            const canalTicket = await guild.channels.create({
                name: `ticket-${tipoTicket}-${usuario.username}`.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                type: ChannelType.GuildText,
                parent: interaction.channel.parentId,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: usuario.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: CARGO_SUPORTE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
                ]
            });

            const embedTicketAberto = new EmbedBuilder()
                .setColor('#0099ff')
                .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
                .setTitle(`SAMURAI E-SPORTS | Ticket - ${tipoTicket.toUpperCase()}`)
                .setDescription(`Olá <@${usuario.id}>, seu ticket foi aberto com sucesso!\n\nAguarde um momento e nossa equipe de suporte (<@&${CARGO_SUPORTE_ID}>) já irá lhe atender.`);

            const botaoFechar = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('fechar_ticket').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger)
            );

            await canalTicket.send({
                content: `<@${usuario.id}> | <@&${CARGO_SUPORTE_ID}>`,
                embeds: [embedTicketAberto],
                components: [botaoFechar]
            });

            await interaction.followUp({ content: `✅ Seu ticket foi criado com sucesso em: <#${canalTicket.id}>`, ephemeral: true }).catch(() => {});
        } catch (e) {
            console.log("Erro ao criar canal de ticket:", e);
            await interaction.followUp({ content: '❌ Ocorreu um erro ao criar o seu ticket.', ephemeral: true }).catch(() => {});
        }
        return;
    }
});

client.login(process.env.DISCORD_TOKEN);
