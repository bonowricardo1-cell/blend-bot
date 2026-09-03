// ============================================================================
// CÓDIGO COMPLETO FINAL & INTEGRADO (RODÍZIO DE ADM + PIX EM JSON + FILAS MISTAS)
// ============================================================================

const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const http = require('http');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Importações dos módulos modularizados
const { limitesFila, filasMistas } = require('./config/queues');
const { handleButtonInteraction } = require('./handlers/buttonHandler');
const { salvarPixNoGitHub } = require('./utils/github');

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

const confirmadosPartida = new Map();
let filaMediadores = [];
let pixConfig = {};

// Link do GIF card do samurai otimizado para todas as filas e embeds
const GIF_SAMURAI_THUMBNAIL = 'https://cdn.discordapp.com/attachments/1461401389711228980/1544899512349196328/Samurai_slashing_text_animation_202609022217-ezgif.com-optimize.gif';

// ==========================================
// PERSISTÊNCIA DO PIX EM JSON
// ==========================================
const pixFile = path.join(__dirname, 'config', 'pixConfig.json');
if (fs.existsSync(pixFile)) {
    try {
        pixConfig = JSON.parse(fs.readFileSync(pixFile, 'utf8'));
    } catch (e) {
        pixConfig = {};
    }
}

async function salvarPix() {
    fs.writeFileSync(pixFile, JSON.stringify(pixConfig, null, 2));
    if (typeof salvarPixNoGitHub === 'function') {
        await salvarPixNoGitHub(pixConfig);
    }
}

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

client.once('ready', () => {
    console.log(`Bot online como: ${client.user.tag}`);
});

// ==========================================
// FUNÇÃO DE RODÍZIO DE ADM AUTOMÁTICO (PADRÃO NULLA - CONFIRMAÇÃO COM BOLINHAS)
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

    const admId = filaMediadores.shift();
    filaMediadores.push(admId);

    try {
        const categoriaDestino = canalOrigem.parent || guild.channels.cache.find(c => c.type === ChannelType.GuildCategory);
        const numPartida = Math.floor(Math.random() * 900000 + 100000);

        const canalPrivado = await guild.channels.create({
            name: `sala-${tipoModo}`.toLowerCase().replace(/\s/g, '-'),
            type: ChannelType.GuildText,
            parent: categoriaDestino ? categoriaDestino.id : null,
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

        const taxaAdm = 0.15;
        
        // Mapeia os jogadores com bolinhas vermelhas inicialmente 🔴 (Padrão Nulla)
        const statusJogadores = jogadoresPartida.map(p => {
            const id = typeof p === 'object' ? p.id : p;
            return `🔴 <@${id}>`;
        }).join('\n');

        const embedConfirmacao = new EmbedBuilder()
            .setColor('#2b2d31')
            .setImage(GIF_SAMURAI_THUMBNAIL)
            .setTitle(`SAMURAI E-SPORTS | Confirmação #${numPartida}`)
            .addFields(
                { name: 'Modo:', value: `${tipoModo.toUpperCase()}`, inline: false },
                { name: 'Valor da Aposta:', value: `${formatarMoeda(valorAposta)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)`, inline: false },
                { name: 'Mediador Designado:', value: `<@${admId}>`, inline: false },
                { name: '👤 Jogadores', value: statusJogadores, inline: false }
            )
            .setFooter({ text: 'Ambos os jogadores devem confirmar para liberar o Pix e iniciar a partida.' });

        const botoesConfirmacao = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`btn_confirmar_${numPartida}`).setLabel('Confirmar').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId(`btn_cancelar_${numPartida}`).setLabel('Cancelar').setStyle(ButtonStyle.Danger).setEmoji('✖️')
        );

        await canalPrivado.send({
            content: `${jogadoresPartida.map(p => typeof p === 'object' ? `<@${p.id}>` : `<@${p}>`).join(' ')} <@${admId}>`,
            embeds: [embedConfirmacao],
            components: [botoesConfirmacao]
        });

    } catch (e) {
        console.log("Erro ao criar canal privado automático:", e);
    }
}

// ==========================================
// PAINEL DE MEDIADORES
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

    linha.addComponents(new ButtonBuilder().setCustomId(`${chaveFila}_sair`).setLabel('Sair da fila').setStyle(ButtonStyle.Danger).setEmoji('✖️'));
    return linha;
}

async function atualizarPainelMisto(interaction, chaveFila) {
    try {
        const fila = filasMistas[chaveFila];
        const mensagem = interaction.message;
        const taxaAdm = 0.15;

        let listaTexto = `Nenhum jogador na fila`;
        if (fila.emus && fila.emus.length > 0) {
            listaTexto = fila.emus.map((id, index) => `<@${id}> | ${index + 1}º Emu`).join('\n');
        }

        const embedAtualizada = new EmbedBuilder()
            .setTitle(`${fila.formato} | SAMURAI E-SPORTS`)
            .setImage(GIF_SAMURAI_THUMBNAIL)
            .setDescription(`🎮 Modo:\n${fila.formato}\n\n💰 Aposta:\n${formatarMoeda(fila.valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👤 Jogadores:\n${listaTexto}`)
            .setColor('#0099ff');

        const linhaBotoes = criarBotoesMisto(chaveFila);
        await mensagem.edit({ embeds: [embedAtualizada], components: [linhaBotoes] });
    } catch (err) {
        console.error('Erro ao atualizar painel misto:', err);
    }
}

// ==========================================
// COMANDOS DE MENSAGEM
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
            .setImage(GIF_SAMURAI_THUMBNAIL)
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
            .setImage(GIF_SAMURAI_THUMBNAIL)
            .setDescription(`🎮 Modo: ${tipoModo}\n💰 Aposta:\n${formatarMoeda(valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👥 **Jogadores na Fila (0/${maxJogadores})**`)
            .setColor('#0099ff');

        const botoes = new ActionRowBuilder();

        if (tipoModo.toLowerCase().includes('1x1')) {
            botoes.addComponents(
                new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Gelo Normal`).setLabel('Gelo Normal').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Gelo Infinito`).setLabel('Gelo Infinito').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`sair|${tipoModo}|${valor}|Sair`).setLabel('Sair').setStyle(ButtonStyle.Danger).setEmoji('✖️')
            );
        } else {
            botoes.addComponents(
                new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Normal`).setLabel('NORMAL').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`entrar|${tipoModo}|${valor}|Full Ump Xm8`).setLabel('FULL UMP XM8').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`sair|${tipoModo}|${valor}|Sair`).setLabel('Sair').setStyle(ButtonStyle.Danger).setEmoji('✖️')
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
            .setImage(GIF_SAMURAI_THUMBNAIL)
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
// INTERAÇÕES (TICKETS E BOTÕES)
// ==========================================
client.on('interactionCreate', async (interaction) => {
    if (interaction.isModalSubmit() && interaction.customId === 'modal_config_pix') {
        const chave = interaction.fields.getTextInputValue('input_chave_pix');
        const nome = interaction.fields.getTextInputValue('input_nome_pix');
        const mensagem = interaction.fields.getTextInputValue('input_msg_pix');

        pixConfig[interaction.user.id] = { chave, nome, mensagem };
        await salvarPix();

        await interaction.reply({
            content: `✅ **Configuração salva com sucesso!**\n\n🔑 **Chave:** \`${chave}\`\n👤 **Nome:** ${nome}\n📝 **Mensagem:** ${mensagem || 'Nenhuma'}`,
            ephemeral: true
        });
        return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'criar_ticket') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true }).catch(() => {});
        }

        const guild = interaction.guild;
        const user = interaction.user;
        const opcaoEscolhida = interaction.values[0];

        try {
            const categoriaDestino = interaction.channel.parent || guild.channels.cache.find(c => c.type === ChannelType.GuildCategory);

            const canalPrivado = await guild.channels.create({
                name: `ticket-${user.username}`.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                type: ChannelType.GuildText,
                parent: categoriaDestino ? categoriaDestino.id : null,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    },
                    {
                        id: client.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
                    },
                ],
            });

            const embedTicketAberto = new EmbedBuilder()
                .setTitle(`🎫 Atendimento | ${opcaoEscolhida.toUpperCase()}`)
                .setDescription(`Olá <@${user.id}>, seu canal de atendimento foi aberto com sucesso!\nA equipe de suporte e a administração já foram notificadas.\n\nClique no botão abaixo quando quiser encerrar e fechar este atendimento.`)
                .setColor('#0099ff');

            const botaoFecharTicket = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('fechar_ticket').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await canalPrivado.send({
                content: `<@${user.id}>`,
                embeds: [embedTicketAberto],
                components: [botaoFecharTicket]
            });

            await interaction.editReply({ content: `✅ Seu ticket foi criado com sucesso em ${canalPrivado}!` });
        } catch (error) {
            console.error("Erro ao criar ticket:", error);
            await interaction.editReply({ content: `❌ Ocorreu um erro ao criar o canal do ticket.` });
        }
        return;
    }

    await handleButtonInteraction(
        interaction, 
        client, 
        confirmadosPartida, 
        pixConfig, 
        filaMediadores, 
        atualizarPainelMediadoresPorMensagem, 
        puxarProximoMediador, 
        atualizarPainelMisto, 
        formatarMoeda, 
        salvarPix
    );
});

client.login(process.env.DISCORD_TOKEN);
