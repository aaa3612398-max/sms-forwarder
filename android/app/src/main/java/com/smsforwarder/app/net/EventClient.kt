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
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class EventClient(context: Context) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .writeTimeout(12, TimeUnit.SECONDS)
        .build()
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val discovery = DiscoveryClient()
    private val pairingStore = PairingStore(context)
    private val deviceIdentity = DeviceIdentity(context)

    data class OutboxItem(val id: String, val envelope: JSONObject)

    fun sendEvent(config: PairingConfig, event: JSONObject): Boolean {
        if (postEvent(config, event)) return true
        val rediscovered = discovery.discover(config) ?: return false
        pairingStore.save(rediscovered)
        return postEvent(rediscovered, event)
    }

    fun pollOutbox(config: PairingConfig): List<OutboxItem> {
        val url = "http://${config.host}:${config.port}/api/v1/outbox"
        val request = Request.Builder()
            .url(url)
            .get()
            .header("X-SF-Device-Id", deviceIdentity.deviceId())
            .header("X-SF-Device-Name", deviceIdentity.deviceName())
            .build()
        return runCatching {
            client.newCall(request).execute().use { resp ->
                if (!resp.isSuccessful) return emptyList()
                val body = resp.body?.string() ?: return emptyList()
                val root = JSONObject(body)
                val arr = root.optJSONArray("items") ?: JSONArray()
                buildList {
                    for (i in 0 until arr.length()) {
                        val o = arr.getJSONObject(i)
                        add(OutboxItem(o.getString("id"), o.getJSONObject("envelope")))
                    }
                }
            }
        }.getOrDefault(emptyList())
    }

    fun ackOutbox(config: PairingConfig, ids: List<String>) {
        if (ids.isEmpty()) return
        val url = "http://${config.host}:${config.port}/api/v1/outbox/ack"
        val body = JSONObject().put("ids", JSONArray(ids)).toString()
        val request = Request.Builder()
            .url(url)
            .post(body.toRequestBody(jsonType))
            .header("X-SF-Device-Id", deviceIdentity.deviceId())
            .build()
        runCatching { client.newCall(request).execute().close() }
    }

    private fun postEvent(config: PairingConfig, event: JSONObject): Boolean {
        val envelope = ProtocolCrypto.encryptEvent(config.secret, event)
        val body = ProtocolCrypto.envelopeToJson(envelope)
        val url = "http://${config.host}:${config.port}/api/v1/events"
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
