package com.smsforwarder.app.toolkit

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.smsforwarder.app.data.PairingStore
import com.smsforwarder.app.net.EventClient
import org.json.JSONObject
import java.util.UUID

class MirrorNotificationService : NotificationListenerService() {
    private val filter by lazy { NotificationFilterStore(this) }
    private val events by lazy { EventClient(this) }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return
        if (!filter.isMirrorEnabled()) return
        val pkg = sbn.packageName ?: return
        if (filter.isPackageBlocked(pkg)) return
        val pairing = PairingStore(this).load() ?: return
        val n = sbn.notification.extras
        val title = n.getCharSequence("android.title")?.toString() ?: ""
        val text = n.getCharSequence("android.text")?.toString() ?: ""
        val appName = try {
            packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString()
        } catch (_: Exception) {
            pkg
        }
        val event = JSONObject().apply {
            put("type", "notification")
            put("id", UUID.randomUUID().toString())
            put("packageName", pkg)
            put("appName", appName)
            put("title", title)
            put("text", text)
            put("timestamp", System.currentTimeMillis())
        }
        events.sendEvent(pairing, event)
    }
}
