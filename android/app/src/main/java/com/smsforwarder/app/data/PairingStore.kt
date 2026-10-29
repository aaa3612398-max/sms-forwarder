package com.smsforwarder.app.data

import android.content.Context
import com.smsforwarder.app.protocol.PairingConfig

class PairingStore(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun save(config: PairingConfig) {
        prefs.edit()
            .putString(KEY_HOST, config.host)
            .putInt(KEY_PORT, config.port)
            .putString(KEY_SECRET, config.secret)
            .putString(KEY_DESKTOP_ID, config.desktopDeviceId)
            .apply()
    }

    fun updateHost(host: String) {
        prefs.edit().putString(KEY_HOST, host).apply()
    }

    fun load(): PairingConfig? {
        val host = prefs.getString(KEY_HOST, null) ?: return null
        val port = prefs.getInt(KEY_PORT, -1)
        val secret = prefs.getString(KEY_SECRET, null) ?: return null
        val desktopId = prefs.getString(KEY_DESKTOP_ID, null) ?: return null
        if (port <= 0) return null
        return PairingConfig(host, port, secret, desktopId)
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    fun isPaired(): Boolean = load() != null

    companion object {
        private const val PREFS = "pairing"
        private const val KEY_HOST = "host"
        private const val KEY_PORT = "port"
        private const val KEY_SECRET = "secret"
        private const val KEY_DESKTOP_ID = "desktop_id"
    }
}
