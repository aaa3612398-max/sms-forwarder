package com.smsforwarder.app.ui

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.smsforwarder.app.R
import com.smsforwarder.app.data.ForwardLogEntry
import com.smsforwarder.app.data.ForwardStatus
import com.smsforwarder.app.databinding.ItemForwardLogBinding
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ForwardLogAdapter : RecyclerView.Adapter<ForwardLogAdapter.VH>() {
    private val items = mutableListOf<ForwardLogEntry>()
    private val fmt = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.CHINA)

    fun submit(list: List<ForwardLogEntry>) {
        items.clear()
        items.addAll(list)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val binding = ItemForwardLogBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return VH(binding)
    }

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: VH, position: Int) {
        holder.bind(items[position])
    }

    inner class VH(private val binding: ItemForwardLogBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(entry: ForwardLogEntry) {
            binding.logSender.text = entry.sender
            binding.logBody.text = entry.bodyPreview
            val status = when (entry.status) {
                ForwardStatus.OK -> binding.root.context.getString(R.string.forward_ok)
                ForwardStatus.PENDING -> binding.root.context.getString(R.string.forward_pending)
                ForwardStatus.FAILED -> binding.root.context.getString(R.string.forward_failed)
            }
            binding.logMeta.text = "${fmt.format(Date(entry.timestamp))} · $status"
        }
    }
}
