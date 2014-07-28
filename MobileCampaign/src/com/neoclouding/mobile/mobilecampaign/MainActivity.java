package com.neoclouding.mobile.mobilecampaign;



import android.app.FragmentManager;
import android.app.FragmentTransaction;
import android.content.res.Configuration;
import android.os.Bundle;
import android.support.v4.app.ActionBarDrawerToggle;
import android.support.v4.view.GravityCompat;
import android.support.v4.widget.DrawerLayout;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.ListView;

import com.salesforce.androidsdk.app.SalesforceSDKManager;
import com.salesforce.androidsdk.rest.RestClient;
import com.salesforce.androidsdk.ui.sfnative.SalesforceActivity;

/**
 * @author marcusvbessa
 * 
 */
public class MainActivity extends SalesforceActivity {

	private String[] mCampaignTypes;

	private DrawerLayout mDrawerLayout;
	private ListView mDrawerList;
	public CharSequence mDrawerTitle;

	private ActionBarDrawerToggle mDrawerToggle;

	private CharSequence selectedCampaignType;

	private SalesforceDataLoader dataLoader;
	
	/***************************************************************************
	 * Android - DrawerItemClickListener 
	 * The click listener for ListView in the navigation drawer
	 **************************************************************************/
	private class DrawerItemClickListener implements ListView.OnItemClickListener {
		@Override
		public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
			selectItem(position);
		}
	}

	/***************************************************************************
	 * Android.onConfigurationChanged 
	 * Called by the system when the device configuration changes 
	 * while your activity is running.
	 **************************************************************************/
	@Override
	public void onConfigurationChanged(Configuration newConfig) {
		super.onConfigurationChanged(newConfig);
		
		// Pass any configuration change to the drawer toggles
		mDrawerToggle.onConfigurationChanged(newConfig);
	}

	/***************************************************************************
	 * Android.onCreate 
	 * Called when the activity is first created. 
	 * Always followed by onStart().
	 **************************************************************************/
	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		setContentView(R.layout.activity_main);

		selectedCampaignType = mDrawerTitle = getTitle();
		mCampaignTypes = getResources().getStringArray(R.array.campaignTypes_array);

		mDrawerList   = (ListView) findViewById(R.id.left_drawer);
		mDrawerLayout = (DrawerLayout) findViewById(R.id.drawer_layout);

		// set a custom shadow that overlays the main content when the drawer opens
		mDrawerLayout.setDrawerShadow(R.drawable.drawer_shadow, GravityCompat.START);

		// set up the drawer's list view with items and click listener
		ArrayAdapter<String> arrayAdapter = new ArrayAdapter<String>(this, R.layout.drawer_list_item, mCampaignTypes);
		mDrawerList.setAdapter(arrayAdapter);
		mDrawerList.setOnItemClickListener(new DrawerItemClickListener());

		// enable ActionBar app icon to behave as action to toggle nav drawer
		getActionBar().setDisplayHomeAsUpEnabled(true);
		getActionBar().setHomeButtonEnabled(true);

		// ActionBarDrawerToggle ties together the the proper interactions
		// between the sliding drawer and the action bar app icon
		mDrawerToggle = new ActionBarDrawerToggle( this 					/* host Activity */
												 , mDrawerLayout 			/* DrawerLayout object */
												 , R.drawable.ic_drawer		/* nav drawer image to replace 'Up' caret */
												 , R.string.drawer_open		/* "open drawer" description for accessibility */
												 , R.string.drawer_close    /* "close drawer" description for accessibility */
		) {
			public void onDrawerClosed(View view) {
				getActionBar().setTitle(selectedCampaignType);
				invalidateOptionsMenu(); // creates call to onPrepareOptionsMenu()
			}

			public void onDrawerOpened(View drawerView) {
				getActionBar().setTitle(null);
				invalidateOptionsMenu(); // creates call to onPrepareOptionsMenu()
			}
		};
		
		mDrawerLayout.setDrawerListener(mDrawerToggle);
		
		if(this.dataLoader==null){
			String apiVersion = getString(R.string.api_version);
			
			this.dataLoader = new SalesforceDataLoader();			
			this.dataLoader.setApiVersion(apiVersion);
			this.dataLoader.setActivity(this);
		}

	}

	/***************************************************************************
	 * Android.onCreateOptionsMenu 
	 * Initialize the contents of the Activity's standard options menu. 
	 * You should place your menu items in to menu. 
	 * This is only called once, the first time the options menu is displayed.
	 **************************************************************************/
	@Override
	public boolean onCreateOptionsMenu(Menu menu) {
		MenuInflater inflater = getMenuInflater();
		inflater.inflate(R.menu.main, menu);
		
		return super.onCreateOptionsMenu(menu);
	}

	/***************************************************************************
	 * Android.onOptionsItemSelected 
	 * This hook is called whenever an item in your options menu is selected.
	 **************************************************************************/
	@Override
	public boolean onOptionsItemSelected(MenuItem item) {
		// The action bar home/up action should open or close the drawer.
		// ActionBarDrawerToggle will take care of this.
		if (mDrawerToggle.onOptionsItemSelected(item)) {
			return true;
		}

		// Handle action buttons
		switch (item.getItemId()) {

		case R.id.action_logout:
			SalesforceSDKManager.getInstance().logout(this);
			return true;

		default:
			return super.onOptionsItemSelected(item);
		}
	}

	/***************************************************************************
	 * Android.onResume 
	 * Called when activity start-up is complete 
	 * (after onStart() and onRestoreInstanceState(Bundle) have been called).
	 * Applications will generally not implement this method; it is intended for
	 * system classes to do final initialization after application code has run.
	 **************************************************************************/
	@Override
	protected void onPostCreate(Bundle savedInstanceState) {
		super.onPostCreate(savedInstanceState);
		
		// Sync the toggle state after onRestoreInstanceState has occurred.
		mDrawerToggle.syncState();
	}

	/***************************************************************************
	 * Android.onPrepareOptionsMenu 
	 * Called whenever we call invalidateOptionsMenu()
	 * Oculta os botões da barra (topo) quando o painel lateral (esquerdo)
	 * é aberto.
	 **************************************************************************/
	@Override
	public boolean onPrepareOptionsMenu(Menu menu) {
		// If the nav drawer is open,
		// hide action items related to the content view
		boolean isDrawerOpen = mDrawerLayout.isDrawerOpen(mDrawerList);
		menu.findItem(R.id.action_logout).setVisible(!isDrawerOpen);
		return super.onPrepareOptionsMenu(menu);
	}

	/***************************************************************************
	 * Android.onResume 
	 * Called when the activity will start interacting with the user. 
	 * Always followed by onPause().
	 **************************************************************************/
	@Override
	public void onResume() {
		super.onResume();
	}

	/***************************************************************************
	 * Salesforce.onResume 
	 * Method that is called after the activity resumes once we have a RestClient.
	 **************************************************************************/
	@Override
	public void onResume(RestClient client) {
		this.dataLoader.setClient(client);
		selectItem(0);
	}

	/***************************************************************************
	 * MobileCampaign - selectItem 
	 * Ação de selecionar um tipo de campanha
	 **************************************************************************/
	private void selectItem(int position) {
		// update the main content by replacing fragments
		MobileCampaignFragment fragment = new CampaignTypeFragment();
		fragment.setSalesforceDataLoader(dataLoader);

		Bundle args = new Bundle();
		args.putInt(CampaignTypeFragment.ARG_TYPE_NUMBER, position);
		fragment.setArguments(args);

		FragmentManager fragmentManager = getFragmentManager();
		FragmentTransaction trn = fragmentManager.beginTransaction();
		FragmentTransaction newTrn = trn.replace(R.id.content_frame, fragment);
		newTrn.commit();

		// update selected item and title, then close the drawer
		mDrawerList.setItemChecked(position, true);
		setTitle(mCampaignTypes[position]);
		mDrawerLayout.closeDrawer(mDrawerList);
	}

	/***************************************************************************
	 * Android.setTitle 
	 * Change the title associated with this activity.
	 **************************************************************************/
	@Override
	public void setTitle(CharSequence title) {
		selectedCampaignType = title;
		if(title==null) {
			title = mDrawerTitle;
		} else {
			title = mDrawerTitle + " :: " + title;
		}
		getActionBar().setTitle(title);
	}

}
