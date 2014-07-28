package com.neoclouding.mobile.mobilecampaign;

import android.app.Fragment;

public abstract class MobileCampaignFragment extends Fragment {

	protected SalesforceDataLoader dataLoader;

	public MobileCampaignFragment() {
		super();
	}

	public void setSalesforceDataLoader(SalesforceDataLoader dataLoader) {
		this.dataLoader = dataLoader;
		
	}

}