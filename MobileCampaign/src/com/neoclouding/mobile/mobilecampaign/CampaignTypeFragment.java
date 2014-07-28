package com.neoclouding.mobile.mobilecampaign;

import java.io.UnsupportedEncodingException;
import java.util.ArrayList;

import org.json.JSONArray;

import android.app.FragmentManager;
import android.app.FragmentTransaction;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.ListView;

/***************************************************************************
 * MobileCampaign - CampaignTypeFragment 
 * Fragment that appears in the "content_frame", shows a campaign list
 **************************************************************************/
public class CampaignTypeFragment extends MobileCampaignFragment {
	
	public  static final String ARG_TYPE_NUMBER   = "type_number";
	private static final String SMS               = "SMS";

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
		
		if(SMS.equalsIgnoreCase(campaignType)) {
			
			try {
				
				dataLoader.query( SalesforceDataLoader.SOBJ_CAMPAIGN
							    , "SELECT ID, Name, NumberSent, NumberOfContacts, NumberOfResponses, Mensagem_SMS__c FROM Campaign WHERE IsActive = true AND Mensagem_SMS__c != '' ORDER BY NAME"
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

		getActivity().setTitle(campaignType);
		return rootView;
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