package com.neoclouding.mobile.mobilecampaign;

import android.content.BroadcastReceiver;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.widget.Toast;

public class SmsReceiver extends BroadcastReceiver {

	@Override
	public void onReceive(Context context, Intent intent) {
		//---get the SMS message passed in---
		Bundle bundle = intent.getExtras();        
		SmsMessage[] records = null;
		
		if (bundle != null) {
			//---retrieve the SMS message received---
			Object[] pdus = (Object[]) bundle.get("pdus");

			records = new SmsMessage[pdus.length];

			for (int i=0; i < records.length; i++){
				records[i] = SmsMessage.createFromPdu((byte[])pdus[i]);

				String phNum = records[i].getOriginatingAddress();  
				String msg = records[i].getMessageBody().toString();

				saveMessageToSalesforce(context, phNum, msg);
				
				deleteMessageFromInbox(context, phNum);
			}
		}
	}

	private void deleteMessageFromInbox(Context context, String phNum) {
		Uri uri = Uri.parse("content://sms/inbox");

		ContentResolver contentResolver = context.getContentResolver();

		String where = "address="+phNum;
		Cursor cursor = contentResolver.query(uri, new String[] { "_id", "thread_id"}, where, null, null);
		
		Toast.makeText(context, "Deleting ("+where+") #" + cursor.getCount(), Toast.LENGTH_SHORT).show();
		
		while (cursor.moveToNext()) {
			long thread_id = cursor.getLong(1);
			where = "thread_id="+thread_id;
			Uri thread = Uri.parse("content://sms/inbox");
			context.getContentResolver().delete(thread, where, null);
		}
	}

	private void saveMessageToSalesforce(Context context, String phNum, String msg) {
		//TODO
		//---display the new SMS message---
		Toast.makeText(context, phNum + " : " + msg, Toast.LENGTH_SHORT).show();
		//---------------------------------
	}


}
