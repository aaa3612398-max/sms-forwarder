package com.smsforwarder.app.toolkit

import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.service.quicksettings.TileService
import android.widget.Toast
import com.smsforwarder.app.data.PairingStore
import com.smsforwarder.app.net.EventClient
import com.smsforwarder.app.toolkit.PhoneEventHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ClipboardTileService : TileService() {
    override fun onClick() {
        val pairing = PairingStore(this).load()
        if (pairing == null) {
            Toast.makeText(this, "请先配对电脑", Toast.LENGTH_SHORT).show()
            return
        }
        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val text = cm.primaryClip?.takeIf { it.description.hasMimeType(ClipDescription.MIMETYPE_TEXT_PLAIN) }
            ?.getItemAt(0)?.coerceToText(this)?.toString()
        if (text.isNullOrBlank()) {
            Toast.makeText(this, "剪贴板为空", Toast.LENGTH_SHORT).show()
            return
        }
        val handler = PhoneEventHandler(this, EventClient(this))
        CoroutineScope(Dispatchers.IO).launch {
            handler.sendClipboard(pairing, text)
        }
        Toast.makeText(this, "剪贴板已发送", Toast.LENGTH_SHORT).show()
    }
}
