package com.smsforwarder.app.net

import android.content.Context
import com.smsforwarder.app.data.DeviceIdentity
import com.smsforwarder.app.data.PairingStore
import com.smsforwarder.app.protocol.PairingConfig
import com.smsforwarder.app.protocol.ProtocolCrypto
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class MessageClient(private val context: Context) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .writeTimeout(12, TimeUnit.SECONDS)
        .build()

    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val discovery = DiscoveryClient()
    private val pairingStore = PairingStore(context)
    private val deviceIdentity = DeviceIdentity(context)

    fun send(config: PairingConfig, payload: ProtocolCrypto.SmsPayload): Boolean {
        if (post(config, payload)) return true
        val rediscovered = discovery.discover(config) ?: return false
        pairingStore.save(rediscovered)
        return post(rediscovered, payload)
    }

    private fun post(config: PairingConfig, payload: ProtocolCrypto.SmsPayload): Boolean {
        val envelope = ProtocolCrypto.encryptPayload(config.secret, payload)
        val body = ProtocolCrypto.envelopeToJson(envelope)
        val url = "http://${config.host}:${config.port}/api/v1/messages"
        val request = Request.Builder()
            .url(url)
            .post(body.toRequestBody(jsonType))
            .header("X-SF-Device-Id", deviceIdentity.deviceId())
            .header("X-SF-Device-Name", deviceIdentity.deviceName())
            .build()
        return runCatching {
            client.newCall(request).execute().use { resp -> resp.isSuccessful }
        }.getOrDefault(false)
    }
}
