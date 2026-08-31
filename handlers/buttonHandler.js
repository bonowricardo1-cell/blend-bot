const { EmbedBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

async function handleButtonInteraction(
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
) {
    const { customId, user, message, guild } = interaction;
    if (!customId) return;

    // =========================================================================
    // 1. MODAL DE CONFIGURAÇÃO DE PIX
    // =========================================================================
    if (interaction.isModalSubmit() && customId === 'modal_config_pix') {
        const chave = interaction.fields.getTextInputValue('input_chave_pix');
        const nome = interaction.fields.getTextInputValue('input_nome_pix');
        const mensagem = interaction.fields.getTextInputValue('input_msg_pix');

        pixConfig[user.id] = { chave, nome, mensagem };
        await salvarPix();

        return interaction.reply({
            content: `✅ **Configuração salva com sucesso!**\n\n🔑 **Chave:** \`${chave}\`\n👤 **Nome:** ${nome}\n📝 **Mensagem:** ${mensagem || 'Nenhuma'}`,
            ephemeral: true
        });
    }

    // A partir daqui, as interações de botões costumam precisar de deferUpdate
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
    }

    // =========================================================================
    // 2. TRATAMENTO PARA FILAS MISTAS
    // =========================================================================
    const { filasMistas, limitesFila } = require('../config/queues');
    let chaveFilaMista = customId.split('_')[0];

    if (filasMistas && filasMistas[chaveFilaMista]) {
        const fila = filasMistas[chaveFilaMista];
        const partes = customId.split('_');
        const acao = partes[1]; 

        if (acao === 'emu') {
            if (!fila.emus) fila.emus = [];
            if (fila.emus.includes(user.id)) {
                return interaction.followUp({ content: '❌ Você já está nesta fila!', ephemeral: true });
            }

            let totalFilasUsuario = 0;
            for (const fKey in filasMistas) {
                if (filasMistas[fKey].emus && filasMistas[fKey].emus.includes(user.id)) totalFilasUsuario++;
            }
            if (global.filasGlobais) {
                for (const [fKey, lista] of global.filasGlobais.entries()) {
                    if (lista.some(j => j.id === user.id)) totalFilasUsuario++;
                }
            }
            if (totalFilasUsuario >= 3) {
                return interaction.followUp({ content: '❌ Você já atingiu o limite máximo de 3 filas simultâneas!', ephemeral: true });
            }

            if (fila.emus.length >= (fila.maxTotal || 2)) {
                return interaction.followUp({ content: '❌ As vagas já estão esgotadas!', ephemeral: true });
            }

            fila.emus.push(user.id);
            await interaction.followUp({ content: `✅ Vaga garantida!`, ephemeral: true });
            await atualizarPainelMisto(interaction, chaveFilaMista);

            if (fila.emus.length >= (fila.maxTotal || 2)) {
                const jogadoresPartida = [...fila.emus];
                fila.emus = []; 

                const taxaAdm = 0.15;
                const embedVazio = new EmbedBuilder()
                    .setTitle(`${fila.formato} | SAMURAI E-SPORTS`)
                    .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
                    .setDescription(`🎮 Modo:\n${fila.formato}\n\n💰 Aposta:\n${formatarMoeda(fila.valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👤 Jogadores:\nNenhum jogador na fila`)
                    .setColor('#0099ff');

                await message.edit({ embeds: [embedVazio] }).catch(() => {});
                await puxarProximoMediador(guild, jogadoresPartida, fila.formato, fila.valor, interaction.channel);
            }

        } else if (acao === 'sair') {
            if (!fila.emus || !fila.emus.includes(user.id)) {
                return interaction.followUp({ content: '⚠️ Você não está nesta fila.', ephemeral: true });
            }
            fila.emus = fila.emus.filter(id => id !== user.id);
            await interaction.followUp({ content: '🚪 Você saiu da fila.', ephemeral: true });
            await atualizarPainelMisto(interaction, chaveFilaMista);
        }
        return;
    }

    // =========================================================================
    // 3. TRATAMENTO PARA FILAS NORMAIS (separadas por |)
    // =========================================================================
    if (customId.includes('|')) {
        const partes = customId.split('|');
        if (partes.length < 4) return;

        const [acao, modo, valorStr, opcaoEscolhida] = partes;
        const valor = parseFloat(valorStr);
        const taxaAdm = 0.15;
        const chaveFila = `${message.id}`;
        const maxJogadores = limitesFila[modo.toLowerCase()] || 2;

        if (!global.filasGlobais) global.filasGlobais = new Map();
        if (!global.filasGlobais.has(chaveFila)) global.filasGlobais.set(chaveFila, []);
        let listaJogadores = global.filasGlobais.get(chaveFila);

        if (acao === 'entrar') {
            if (listaJogadores.some(j => j.id === user.id)) {
                return interaction.followUp({ content: '❌ Você já está nesta fila!', ephemeral: true }).catch(() => {});
            }

            let totalFilasUsuario = 0;
            for (const fKey in filasMistas) {
                if (filasMistas[fKey].emus && filasMistas[fKey].emus.includes(user.id)) totalFilasUsuario++;
            }
            for (const [fKey, lista] of global.filasGlobais.entries()) {
                if (lista.some(j => j.id === user.id)) totalFilasUsuario++;
            }
            if (totalFilasUsuario >= 3) {
                return interaction.followUp({ content: '❌ Você já atingiu o limite máximo de 3 filas simultâneas!', ephemeral: true });
            }

            listaJogadores.push({ id: user.id, opcao: opcaoEscolhida });
            await interaction.followUp({ content: '✅ Vaga garantida!', ephemeral: true }).catch(() => {});
        } else if (acao === 'sair') {
            const index = listaJogadores.findIndex(j => j.id === user.id);
            if (index !== -1) {
                listaJogadores.splice(index, 1);
                await interaction.followUp({ content: '🚪 Você saiu da fila.', ephemeral: true }).catch(() => {});
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
            global.filasGlobais.set(chaveFila, []);

            const embedVazio = new EmbedBuilder()
                .setTitle(`${modo.toUpperCase()} | SAMURAI E-SPORTS`)
                .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHdudGQ1eG1vdmR1aWcxdnVsbnFhaGZjMTJ5MTFhM2dtZTc0aDI4biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKxt7oY3C5A7CpLRGZ/giphy.gif')
                .setDescription(`🎮 Modo: ${modo}\n💰 Aposta:\n${formatarMoeda(valor)} (+ ${formatarMoeda(taxaAdm)} Taxa ADM)\n\n👥 **Jogadores na Fila (0/${maxJogadores})**`)
                .setColor('#0099ff');

            await message.edit({ embeds: [embedVazio] }).catch(() => {});
            await puxarProximoMediador(guild, jogadoresPartida, modo, valor, interaction.channel);
        }
        return;
    }

    // =========================================================================
    // 4. TRATAMENTO PARA FILA DE MEDIADORES (IDs corrigidos para btn_)
    // =========================================================================
    if (['btn_entrar_fila', 'btn_sair_fila', 'btn_atualizar_fila', 'btn_reset_fila'].includes(customId)) {
        if (!filaMediadores) return;

        if (customId === 'btn_entrar_fila') {
            if (!filaMediadores.includes(user.id)) {
                filaMediadores.push(user.id);
                await interaction.followUp({ content: '✅ Você entrou na fila de mediadores!', ephemeral: true }).catch(() => {});
            } else {
                await interaction.followUp({ content: '⚠️ Você já está na fila de mediadores.', ephemeral: true }).catch(() => {});
            }
        } else if (customId === 'btn_sair_fila') {
            const idx = filaMediadores.indexOf(user.id);
            if (idx !== -1) {
                filaMediadores.splice(idx, 1);
                await interaction.followUp({ content: '🚪 Você saiu da fila de mediadores.', ephemeral: true }).catch(() => {});
            } else {
                await interaction.followUp({ content: '⚠️ Você não está na fila de mediadores.', ephemeral: true }).catch(() => {});
            }
        } else if (customId === 'btn_atualizar_fila') {
            await interaction.followUp({ content: '🔄 Fila atualizada!', ephemeral: true }).catch(() => {});
        } else if (customId === 'btn_reset_fila') {
            filaMediadores.length = 0;
            await interaction.followUp({ content: '🧹 Fila de mediadores resetada!', ephemeral: true }).catch(() => {});
        }

        if (typeof atualizarPainelMediadoresPorMensagem === 'function') {
            await atualizarPainelMediadoresPorMensagem(message);
        }
        return;
    }

    // =========================================================================
    // 5. PAINEL DE PIX (Abrir Modal / Ver QR Code / Testar)
    // =========================================================================
    if (customId === 'btn_config_pix') {
        const modal = new ModalBuilder()
            .setCustomId('modal_config_pix')
            .setTitle('Configuração de Chave Pix');

        const inputChave = new TextInputBuilder()
            .setCustomId('input_chave_pix')
            .setLabel('Sua Chave Pix (Telefone, Email, CPF...)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const inputNome = new TextInputBuilder()
            .setCustomId('input_nome_pix')
            .setLabel('Nome Completo do Titular')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const inputMsg = new TextInputBuilder()
            .setCustomId('input_msg_pix')
            .setLabel('Mensagem opcional de pré-pagamento')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(inputChave),
            new ActionRowBuilder().addComponents(inputNome),
            new ActionRowBuilder().addComponents(inputMsg)
        );

        return interaction.showModal(modal);
    }

    if (customId === 'btn_ver_qrcode') {
        const config = pixConfig[user.id];
        if (!config || !config.chave) {
            return interaction.followUp({ content: '❌ Você ainda não configurou sua chave Pix! Clique em "Configurar Pix".', ephemeral: true });
        }
        return interaction.followUp({ content: `📷 **Sua Chave Pix Cadastrada:** \`${config.chave}\` (${config.nome})`, ephemeral: true });
    }

    if (customId === 'btn_testar_pix') {
        const config = pixConfig[user.id];
        if (!config || !config.chave) {
            return interaction.followUp({ content: '❌ Você ainda não configurou sua chave Pix!', ephemeral: true });
        }
        return interaction.followUp({ content: `🧪 **Pix funcionando perfeitamente!** Chave configurada: \`${config.chave}\``, ephemeral: true });
    }

    // =========================================================================
    // 6. BOTÃO DE FECHAR TICKET
    // =========================================================================
    if (customId === 'fechar_ticket') {
        await interaction.followUp({ content: '🔒 Fechando este canal de atendimento em instantes...', ephemeral: true }).catch(() => {});
        setTimeout(async () => {
            await interaction.channel.delete().catch(() => {});
        }, 3000);
        return;
    }
}

module.exports = { handleButtonInteraction };
