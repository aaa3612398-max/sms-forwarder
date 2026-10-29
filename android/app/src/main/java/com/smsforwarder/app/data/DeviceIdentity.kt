package com.smsforwarder.app.data

import android.content.Context
import android.os.Build
import java.util.UUID

class DeviceIdentity(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun deviceId(): String {
        val existing = prefs.getString(KEY_ID, null)
        if (existing != null) return existing
        val id = UUID.randomUUID().toString()
        prefs.edit().putString(KEY_ID, id).apply()
        return id
    }

    fun deviceName(): String {
        val model = Build.MODEL ?: "Android"
        val brand = Build.BRAND ?: ""
        return if (brand.isBlank()) model else "$brand $model"
    }

    companion object {
        private const val PREFS = "device_identity"
        private const val KEY_ID = "phone_device_id"
    }
}
