package com.smsforwarder.app.toolkit

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.Base64

class FileReceiveHelper(private val context: Context) {
    private val chunks = mutableMapOf<String, MutableMap<Int, ByteArray>>()
    private val names = mutableMapOf<String, String>()

    fun onChunk(event: JSONObject) {
        val id = event.getString("transferId")
        val map = chunks.getOrPut(id) { mutableMapOf() }
        names[id] = event.getString("name")
        val data = Base64.getDecoder().decode(event.getString("data"))
        map[event.getInt("index")] = data
    }

    fun onEnd(event: JSONObject) {
        val id = event.getString("transferId")
        val name = names[id] ?: event.getString("name")
        val map = chunks.remove(id) ?: return
        names.remove(id)
        val total = map.keys.maxOrNull()?.plus(1) ?: return
        val out = ByteArray(map.values.sumOf { it.size })
        var pos = 0
        for (i in 0 until total) {
            val part = map[i] ?: return
            System.arraycopy(part, 0, out, pos, part.size)
            pos += part.size
        }
        saveToDownloads(name, out)
    }

    private fun saveToDownloads(name: String, bytes: ByteArray) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, name)
                put(MediaStore.Downloads.MIME_TYPE, "application/octet-stream")
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            }
            val uri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            if (uri != null) {
                context.contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
            }
            return
        }
        @Suppress("DEPRECATION")
        val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        dir.mkdirs()
        FileOutputStream(File(dir, name)).use { it.write(bytes) }
    }
}
