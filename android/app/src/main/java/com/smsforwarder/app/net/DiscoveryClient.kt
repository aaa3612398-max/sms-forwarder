package com.smsforwarder.app.net

import com.smsforwarder.app.protocol.DiscoveryProtocol
import com.smsforwarder.app.protocol.PairingConfig
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress

class DiscoveryClient {
    fun discover(config: PairingConfig, timeoutMs: Int = 2500): PairingConfig? {
        val nonce = DiscoveryProtocol.randomNonce()
        val req = DiscoveryProtocol.buildRequest(config.secret, nonce)
        val payload = DiscoveryProtocol.requestJson(req).toByteArray(Charsets.UTF_8)

        var socket: DatagramSocket? = null
        try {
            socket = DatagramSocket(null).apply {
                broadcast = true
                soTimeout = timeoutMs
                reuseAddress = true
                bind(null)
            }
            val broadcast = InetAddress.getByName("255.255.255.255")
            socket.send(
                DatagramPacket(payload, payload.size, broadcast, DiscoveryProtocol.DISCOVERY_UDP_PORT),
            )

            val buf = ByteArray(2048)
            val start = System.currentTimeMillis()
            while (System.currentTimeMillis() - start < timeoutMs) {
                val packet = DatagramPacket(buf, buf.size)
                try {
                    socket.receive(packet)
                } catch (_: java.net.SocketTimeoutException) {
                    break
                }
                val raw = String(packet.data, packet.offset, packet.length, Charsets.UTF_8)
                val res = DiscoveryProtocol.parseResponse(raw) ?: continue
                if (res.n != nonce) continue
                if (!DiscoveryProtocol.verifyResponse(config.secret, res, config.desktopDeviceId)) continue
                return config.copy(host = res.h, port = res.p, desktopDeviceId = res.d)
            }
        } catch (_: Exception) {
            return null
        } finally {
            socket?.close()
        }
        return null
    }
}
