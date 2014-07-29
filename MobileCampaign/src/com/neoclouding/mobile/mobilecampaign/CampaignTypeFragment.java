package com.neoclouding.mobile.mobilecampaign;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

import org.json.JSONArray;

import com.salesforce.androidsdk.app.SalesforceSDKManager;
import com.salesforce.androidsdk.ui.SalesforceR;

import android.app.AlertDialog;
import android.app.FragmentManager;
import android.app.FragmentTransaction;
import android.content.ContentResolver;
import android.content.Context;
import android.content.DialogInterface;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.ListView;
import android.widget.Toast;

/***************************************************************************
 * MobileCampaign - CampaignTypeFragment 
 * Fragment that appears in the "content_frame", shows a campaign list
 **************************************************************************/
public class CampaignTypeFragment extends MobileCampaignFragment {

	public  static final String ARG_TYPE_NUMBER   = "type_number";
	private static final String SEND_SMS          = "Send SMS";
	private static final String RECEIVE_SMS       = "Receive SMS";

	private ArrayAdapter<String> listAdapter;

	/***************************************************************************
	 * Construtor padr‹o
	 **************************************************************************/
	public CampaignTypeFragment() {
		// Empty constructor required for fragment subclasses
	}

	/***************************************************************************
	 * MobileCampaign - onCreateView
	 **************************************************************************/
	@Override
	public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
		View rootView = inflater.inflate(R.layout.fragment_campaigntypes, container, false);

		int i = getArguments().getInt(ARG_TYPE_NUMBER);
		String campaignType = getResources().getStringArray( R.array.campaignTypes_array )[i];

		// Create list adapter
		ArrayList<String> arrayList = new ArrayList<String>();
		listAdapter = new ArrayAdapter<String>(getActivity(), android.R.layout.simple_list_item_1, arrayList);

		ListView listView = (ListView) rootView.findViewById(R.id.campaigns_list);
		listView.setAdapter(listAdapter);
		listView.setOnItemClickListener(new ListItemClickListener());

		if(SEND_SMS.equalsIgnoreCase(campaignType)) {
			sendSMS();

		} else if(RECEIVE_SMS.equalsIgnoreCase(campaignType)) {
			readSMS();

		}

		getActivity().setTitle(campaignType);
		return rootView;
	}

	private void readSMS() {
		try {
			// Create Inbox box URI
			Uri inboxURI = Uri.parse("content://sms/inbox");

			// List required columns
			String[] reqCols = new String[] { "_id", "thread_id", "address", "body" };

			// Get Content Resolver object, which will deal with Content Provider
			ContentResolver contentResolver = getActivity().getContentResolver();

			// Fetch Inbox SMS Message from Built-in Content Provider
			Cursor cur = contentResolver.query(inboxURI, reqCols, null, null, null);

			while (cur.moveToNext()) {
				String pid = cur.getString(0);
				String thread_id = cur.getString(1);
				String address = cur.getString(2);
				String body = cur.getString(3);

				saveMessageToSalesforce(address, body);

				contentResolver.delete(Uri.parse("content://sms"), "_id=?", new String[] {pid});
			}
			
			final AlertDialog alertDialog = new AlertDialog.Builder(getActivity()).create();
			alertDialog.setTitle("Receber SMS");
			alertDialog.setMessage("Mensagens recebidas");
			alertDialog.setButton(AlertDialog.BUTTON_NEUTRAL, "OK", new DialogInterface.OnClickListener() {
				public void onClick(DialogInterface dialog, int which) {
					alertDialog.dismiss();
				}
			});
			alertDialog.show();


		} catch (IOException e) {
			SalesforceSDKManager instance = SalesforceSDKManager.getInstance();
			SalesforceR salesforceR = instance.getSalesforceR();
			int stringGenericError = salesforceR.stringGenericError();

			String strException = getActivity().getString(stringGenericError, e.toString());

			Toast makeText = Toast.makeText(getActivity(), strException, Toast.LENGTH_LONG);
			makeText.show();

			e.printStackTrace();
		}
	}

	private void saveMessageToSalesforce(String phNum, String msg) throws IOException {
		Map<String, Object> fields = new HashMap<String, Object>();
		fields.put("Status__c", "recebida");
		fields.put("Celular__c", phNum);
		fields.put("Mensagem__c", msg);
		fields.put("RecordTypeId", "012A00000019hHW");

		dataLoader.insert(SalesforceDataLoader.SOBJ_MENSAGEM__C, fields);
	}


	private void sendSMS() {
		try {

			String soql = getResources().getString(R.string.query_SMS_Campaigns);

			dataLoader.query( SalesforceDataLoader.SOBJ_CAMPAIGN
					, soql
					, new AbstractCommand() {
				@Override
				public void execute() throws Exception {
					JSONArray records = (JSONArray)this.args.get(ARG_RECORDS);

					listAdapter.clear();
					for (int i = 0; i < records.length(); i++) {
						listAdapter.add(records.getJSONObject(i).getString("Name"));
					}
				}
			});

		} catch (UnsupportedEncodingException e) {
			e.printStackTrace();
		}
	}

	/***************************************************************************
	 * Android - ListItemSelectedListener 
	 * The click listener for ListView in the campaigns list
	 **************************************************************************/
	private class ListItemClickListener implements AdapterView.OnItemClickListener {

		@Override
		public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
			CampaignDetailFragment fragment = new CampaignDetailFragment();
			fragment.setSalesforceDataLoader(dataLoader);

			Bundle args = new Bundle();
			args.putInt(CampaignDetailFragment.ARG_RECORD_ID, position);
			fragment.setArguments(args);

			FragmentManager fragmentManager = getFragmentManager();
			FragmentTransaction trn = fragmentManager.beginTransaction();
			FragmentTransaction newTrn = trn.replace(R.id.content_frame, fragment);
			newTrn.commit();
		}

	}

	public void setListAdapter(ArrayAdapter<String> listAdapter) {
		this.listAdapter = listAdapter;
	}

}