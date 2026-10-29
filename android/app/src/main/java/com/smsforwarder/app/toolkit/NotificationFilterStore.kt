package com.smsforwarder.app.toolkit

import android.content.Context

class NotificationFilterStore(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun isMirrorEnabled(): Boolean = prefs.getBoolean(KEY_ENABLED, false)

    fun setMirrorEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_ENABLED, enabled).apply()
    }

    fun isPackageBlocked(packageName: String): Boolean {
        val blocked = prefs.getStringSet(KEY_BLOCKED, emptySet()) ?: emptySet()
        return blocked.contains(packageName)
    }

    fun setBlockedPackages(packages: Set<String>) {
        prefs.edit().putStringSet(KEY_BLOCKED, packages).apply()
    }

    fun getBlockedPackages(): Set<String> =
        prefs.getStringSet(KEY_BLOCKED, emptySet()) ?: emptySet()

    companion object {
        private const val PREFS = "notification_filter"
        private const val KEY_ENABLED = "mirror_enabled"
        private const val KEY_BLOCKED = "blocked_packages"
    }
}
