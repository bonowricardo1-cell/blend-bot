const { EmbedBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
    }

    const { customId, user, message, guild } = interaction;
    if (!customId) return;

    // =========================================================================
    // 1. TRATAMENTO PARA FILAS MISTAS
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

            // Validação de até 3 filas simultâneas do usuário
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
                await puxarProximoMediador(interaction.guild, jogadoresPartida, fila.formato, fila.valor, interaction.channel);
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
    // 2. TRATAMENTO PARA FILAS NORMAIS (separadas por |)
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

            // Validação de até 3 filas simultâneas
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
            await puxarProximoMediador(interaction.guild, jogadoresPartida, modo, valor, interaction.channel);
        }
        return;
    }

    // =========================================================================
    // 3. TRATAMENTO PARA FILA DE MEDIADORES / ADMINS
    // =========================================================================
    if (customId === 'entrar_mediador' || customId === 'sair_mediador' || customId === 'atualizar_mediador' || customId === 'reset_mediador') {
        if (!filaMediadores) return;

        if (customId === 'entrar_mediador') {
            if (!filaMediadores.includes(user.id)) {
                filaMediadores.push(user.id);
                await interaction.followUp({ content: '✅ Você entrou na fila de mediadores!', ephemeral: true }).catch(() => {});
            } else {
                await interaction.followUp({ content: '⚠️ Você já está na fila de mediadores.', ephemeral: true }).catch(() => {});
            }
        } else if (customId === 'sair_mediador') {
            const idx = filaMediadores.indexOf(user.id);
            if (idx !== -1) {
                filaMediadores.splice(idx, 1);
                await interaction.followUp({ content: '🚪 Você saiu da fila de mediadores.', ephemeral: true }).catch(() => {});
            } else {
                await interaction.followUp({ content: '⚠️ Você não está na fila de mediadores.', ephemeral: true }).catch(() => {});
            }
        } else if (customId === 'atualizar_mediador') {
            await interaction.followUp({ content: '🔄 Fila atualizada!', ephemeral: true }).catch(() => {});
        } else if (customId === 'reset_mediador') {
            filaMediadores.length = 0;
            await interaction.followUp({ content: '🧹 Fila de mediadores resetada!', ephemeral: true }).catch(() => {});
        }

        if (typeof atualizarPainelMediadoresPorMensagem === 'function') {
            await atualizarPainelMediadoresPorMensagem(message);
        }
        return;
    }

    // =========================================================================
    // 4. BOTÃO DE FECHAR TICKET
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
