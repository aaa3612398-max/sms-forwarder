package com.smsforwarder.app.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.smsforwarder.app.data.PairingStore
import com.smsforwarder.app.net.EventClient
import com.smsforwarder.app.toolkit.PhoneEventHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ShareSendActivity : AppCompatActivity() {
    private val scope = CoroutineScope(Dispatchers.Main)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pairing = PairingStore(this).load()
        if (pairing == null) {
            Toast.makeText(this, "请先配对电脑", Toast.LENGTH_LONG).show()
            finish()
            return
        }
        val handler = PhoneEventHandler(this, EventClient(this))
        scope.launch {
            val ok = withContext(Dispatchers.IO) { dispatchShare(handler, pairing) }
            Toast.makeText(
                this@ShareSendActivity,
                if (ok) "已发送到电脑" else "发送失败",
                Toast.LENGTH_SHORT,
            ).show()
            finish()
        }
    }

    private fun dispatchShare(
        handler: PhoneEventHandler,
        pairing: com.smsforwarder.app.protocol.PairingConfig,
    ): Boolean {
        val stream = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
        if (stream != null) {
            return sendStream(handler, pairing, stream)
        }
        val text = intent.getStringExtra(Intent.EXTRA_TEXT)
        if (!text.isNullOrBlank()) {
            handler.sendClipboard(pairing, text)
            return true
        }
        return false
    }

    private fun sendStream(
        handler: PhoneEventHandler,
        pairing: com.smsforwarder.app.protocol.PairingConfig,
        uri: Uri,
    ): Boolean {
        return runCatching {
            val name = uri.lastPathSegment ?: "shared.bin"
            val mime = contentResolver.getType(uri) ?: "application/octet-stream"
            val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return false
            if (bytes.size > 10 * 1024 * 1024) return false
            handler.sendFile(pairing, name, mime, bytes)
            true
        }.getOrDefault(false)
    }
}
