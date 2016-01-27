// v0.32
function currTimeSeconds()
{
	var now = new Date();
	return now.getTime() / 1000;
}

function getAllCharacters( playfabID )
{
	var characters = server.GetAllUsersCharacters({ PlayFabId: playfabID }).Characters;
	for (i = 0; i < characters.length; i++) 
	{ 
		var info = characters[i];
		var data = server.GetCharacterData({
							PlayFabId: playfabID,
							CharacterId: characters[i].CharacterId });
		var inventory = server.GetCharacterInventory({
							PlayFabId: playfabID,
							CharacterId: characters[i].CharacterId });	
		
		characters[i] = { Info: info, Data: data, Inventory: inventory };
	}	
	return characters;
}


/*********************************************************************************
***************************** GETTING DATA FROM SERVER **************************
**********************************************************************************/


/* This function query all the catalogs given in the 'args.Catalogs' parameter. */
handlers.downloadCatalogs = function(args)	
{
	var log = "Download catalog function started.";
	
	var catalogs = args.Catalogs;
	log += "\n Catalog Versions array length: "+catalogs.length;
	
	var catalogData = [];
	
	for(i = 0; i < catalogs.length; i++)
	{
		log += "\n " + i +". - loading " + catalogs[i] + " catalog";
		catalogData[i] = server.GetCatalogItems({ CatalogVersion: catalogs[i] });
	}
	
	return {msg : log, Catalogs : catalogData, serverTime: currTimeSeconds()};
}

/* This method returns the data of the specified player. 
 *  UserInfo, UserStatistics, UserData, UserInventory
 *  and the Characters of the user with their CharacterData and CharacterInventory 
 */
handlers.getPlayerData = function(args)	
{
	var log = "Download player data is started. " + args.PlayfabID;
	
	var playfabID = args.PlayfabID;
	if(playfabID == "")
		playfabID = currentPlayerId;
	
	log += "\n PlayfabID: "+playfabID;
	
	// USERINFO
	var userInfo = server.GetUserAccountInfo({ PlayFabId: playfabID }).UserInfo;
	
	// STATS
	var statistics = server.GetUserStatistics({ PlayFabId: playfabID }).UserStatistics;
	
	// DATA
	var data = server.GetUserData({ PlayFabId: playfabID });	
	
	// INVENTORY
	var inventory = server.GetUserInventory({ PlayFabId: playfabID });
	
	// CHARACTERS
	var characters = getAllCharacters(playfabID);

	return {msg : log, UserInfo: userInfo, Statistics: statistics, Data: data, Inventory: inventory, Characters: characters, serverTime: currTimeSeconds()};
}

/* This method returns the data of the specified player. */
handlers.getPlayersCharacters = function(args)	
{
	var playfabID = args.PlayfabID;
	var characters = getAllCharacters(playfabID);
	return {msg : log, Characters: characters, serverTime: currTimeSeconds()};
}

/* This function returns the player's sqad. Squad is the team of characters that are participe in the battle.
 * Returns these characters custom data and inventory too.
 * Parameter needed: 'PlayerID'.
 */
handlers.getPlayerSquad = function(args)
{
	var PlayerID = args.PlayerID;

	// Player data	
	var userData = server.GetUserData({ PlayFabId: PlayerID, Keys: ["CharactersForBattle"] }).Data;
	var characterIDList = ((typeof userData.CharactersForBattle != 'undefined') && (typeof userData.CharactersForBattle.Value != 'undefined') && userData.CharactersForBattle.Value != "") ? userData.CharactersForBattle.Value.split('|') : "";
	
	// Load all the player character
	var characterList = server.GetAllUsersCharacters({ PlayFabId: PlayerID }).Characters;
	
	for (i = 0; i < characterList.length; i++) 
	{ 
		var needThisCharacter = false;
		for(j = 0; j < characterIDList.length; j++)
		{
			if(characterIDList[j] == characterList[i].CharacterId)
			{
				needThisCharacter = true;
				break;
			}
		}
		
		if(needThisCharacter)
		{		
			var info = characterList[i];
			var data = server.GetCharacterData({
								PlayFabId: PlayerID,
								CharacterId: characters[i].CharacterId });
			var inventory = server.GetCharacterInventory({
								PlayFabId: PlayerID,
								CharacterId: characters[i].CharacterId });	
			
			characterList[i] = { Info: info, Data: data, Inventory: inventory };		
		}
		else
			characterList.splice(i, 1);						
	}
	
	return { toons : characterList, serverTime: currTimeSeconds()	};
}

/* Downloads the selected player data */ 
handlers.getTargetPlayerData = function(args)
{
	var EnemyPlayerID = args.EnemyPlayerID;
	
	// query buildings
	var inventory = server.GetUserInventory({ PlayFabId: EnemyPlayerID, CatalogVersion: "Buildings"});
		
	return{ buildings: inventory.Inventory, currencies: inventory.VirtualCurrency, serverTime: currTimeSeconds() };
	
	
}



/*********************************************************************************
********************************** SIMPLE MANIPULATIONS **************************
**********************************************************************************/

/* Selling an item 
 * Two parameters needed: ItemID and the item's CatalogVersion.
 */
handlers.sellItem = function(args)
{
	var itemID = args.ItemID;
	var itemInstanceID = args.ItemInstanceID;
	var catalogVersion = args.CatalogVersion;
		
	// Get item from the catalog
	var catalog = server.GetCatalogItems({ CatalogVersion : catalogVersion}).Catalog;
	var item;
	for( i = 0; i < catalog.length; i++)
	{
		if(catalog[i].ItemId == itemID)
			item = catalog[i];
	}
	
	// adjust currency
	server.AddUserVirtualCurrency({
				PlayFabId: currentPlayerId,
				VirtualCurrency: "GC",
				Amount: item.VirtualCurrencyPrices.GC
	});
	
	// remove one stack
	server.ModifyItemUses({ PlayFabId: currentPlayerId, ItemInstanceId: itemInstanceID, UsesToAdd: -1 });
	
	// query the inventory
	var inventory = server.GetUserInventory({ PlayFabId: currentPlayerId });
	
	return {  Inventory : inventory.Inventory, Currency: inventory.VirtualCurrency, Error : "", serverTime: currTimeSeconds() };
}

/* Consume an item.
 * Three parameter needed: ItemID, item's CatalogVersion and the CharacterID
 */
handlers.consumeItem = function(args)
{
	var itemID = args.ItemID;
	var catalogVersion = args.CatalogVersion;
	var characterID = args.CharacterId;
	
	// Get this item from the inventory
	var inventory = server.GetCharacterInventory({
					PlayFabId: currentPlayerId,
					CharacterId: characterID,
					CatalogVersion: catalogVersion,
					});
	
	// Get item instance id
	for( i = 0; i < inventory.Inventory.length; i++)
	{
		if(inventory.Inventory[i].ItemId == itemID)
		{
			var itemInstanceID = inventory.Inventory[i].ItemInstanceId;
			// MoveItemToCharacterFromUser
			server.MoveItemToUserFromCharacter({ PlayFabId: currentPlayerId, CharacterId: characterID, ItemInstanceId: itemInstanceID });
			// Modify item uses
			server.ModifyItemUses({ PlayFabId: currentPlayerId, ItemInstanceId: itemInstanceID, UsesToAdd: -1 });	
			return { };
		}
	}	
	return { };
}

/* Equip or Unequip item
 * Parameters: CharacterID, ItemInstanceI
 */
handlers.equipItem = function(args)
{
	// Equip / unequip
	if(args.Equip == "true")
		server.MoveItemToCharacterFromUser({ PlayFabId: currentPlayerId, CharacterId: args.CharacterId, ItemInstanceId: args.ItemInstanceId });
	else
		server.MoveItemToUserFromCharacter({ PlayFabId: currentPlayerId, CharacterId: args.CharacterId, ItemInstanceId: args.ItemInstanceId, });
	
	// Return inventoty & character inventory	
	return { ItemID : args.ItemID,
			 CharacterId : args.CharacterId,
			 ItemInstanceId : args.ItemInstanceId,
			 Equip : (args.Equip == "true"),
			 serverTime: currTimeSeconds()
			 };
}

/* Update character stats
 */
handlers.updateCharacterStats = function(args)
{
	server.UpdateCharacterData({
		PlayFabId: currentPlayerId,
		CharacterId: args.CharacterId,
		Data: args.CharacterStatistics,
		Permission: "Public"
	});	
	
	return {  };
}

/* Buying a character and granting it to the user */
handlers.buyCharacter = function(args)
{
	var items = [args.ItemID];		
	var inventory = server.GetUserInventory({ PlayFabId: currentPlayerId, CatalogVersion: "Characters"}).Inventory;	
	
	var hasCharacterItem = false;
	for(i = 0; i<inventory.length; i++)
	{
		if(inventory[i].ItemID == args.ItemID)
			ok = true;
	}
	
	if(hasCharacterItem == false)
	{
		// Purchase character
		server.GrantItemsToUser({
						CatalogVersion: "Characters",
						PlayFabId: currentPlayerId,
						ItemIds: items,
						Annotation: "Character purchased.",
						});
	}		
	
	var characters = server.GetAllUsersCharacters( {  PlayFabId: currentPlayerId } ).Characters;
	var characterGranted = false;
	for(i = 0; i<characters.length; i++)
	{
		if(characters[i].CharacterType == args.ItemID)
			characterGranted = true;
	}
	
	if(characterGranted == false)
	{
		// Grant character to user
		server.GrantCharacterToUser({
							PlayFabId: currentPlayerId,
							CharacterName: args.ItemID,
							CharacterType: args.ItemID,
						});
	}
		
	return {};
}



/*********************************************************************************
********************************** CRAFTING FUNCTIONS *****************************
**********************************************************************************/

handlers.CheckProgress = function ( args )
{
	var userData = server.GetUserData({ PlayFabId: currentPlayerId, Keys: ["Construct", "Mine", "Craft"]}).Data;  // ADD more!
	var needUpdate = false;	
	
	// Check construction progresses
	var construct = ((typeof userData.Construct != 'undefined') && (typeof userData.Construct.Value != 'undefined') && userData.Construct.Value != "") ? userData.Construct.Value.split('|') : "";
	for( i = 0; i < construct.length; i++)
	{
		if(construct[i] != "")
		{
			var progress = construct[i].split(':');
			// Check if the progress finished
			if(progress[1] <= currTimeSeconds())
			{
				construct.splice(i, 1);
				needUpdate = true;
			}				
		}
	}		
	var constructString = (construct != "" ) ? construct.join("|") : ""; 
	
	
	// Check mine progress
	var playerInventory = server.GetUserInventory({ PlayFabId: currentPlayerId, CatalogVersion: "Buildings" });	
	balance = playerInventory.VirtualCurrency;		
	var mine = ((typeof userData.Mine != 'undefined') && (typeof userData.Mine.Value != 'undefined') && userData.Mine.Value != "") ? userData.Mine.Value.split('|') : "";
	for( i = 0; i < mine.length; i++)
	{
		if(mine[i] != "")
		{
			var buildingInfo =  mine[i].split (':');
			var buildingInstanceID = buildingInfo [0];
			
			// Deserialize the building queue, and iterate through them
			var progresses = buildingInfo [1].split ('-');		
			for( j = 0; j < progresses.length; j++)
			{
				// If this progress is empty continue the cycle.
				if (progresses[j] == "") 
				{
					progresses.splice(j, 1);			
					continue;
				}
				
				var info = progresses[j].split (',');
			
				// Check if the progress finished
				if(info [0] <= currTimeSeconds())
				{		
					// Get the building instance
					var buildingInstance;
					for(i = 0; i < playerInventory.Inventory.length; i++)
					{
						if(playerInventory.Inventory[i].ItemInstanceId == buildingInstanceID)
						{
							buildingInstance = playerInventory.Inventory[i];
							break;
						}
					}		
					if( typeof buildingInstance == 'undefined' )
						return { error : "You don't own this item ("+itemID+","+playerInventory.Inventory.length+")!", serverTime: currTimeSeconds()  }; 
	
					// Check if there is enough storage
					var storage = parseInt(buildingInstance.CustomData.Storage) * (parseInt(buildingInstance.CustomData.Upgrade)+1);
					var storedMaterials = parseInt(buildingInstance.CustomData.StoredMaterial);
					
					if( storedMaterials + parseInt(info[1]) <= storage )
					{
						// Update the buildings storage
						buildingInstance.CustomData.StoredMaterial = storedMaterials + parseInt(info[1]); 
						server.UpdateUserInventoryItemCustomData({ PlayFabId: currentPlayerId, ItemInstanceId: buildingInstanceID, Data: buildingInstance.CustomData});
				
						balance[info[2]] = server.AddUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: info[2], Amount: parseInt(info[1]) }).Balance;
						progresses.splice(j, 1);
						needUpdate = true;
					}						
				}					
			}
			mine[i] = buildingInstanceID +":"+progresses.join('-');
			
			if( progresses.length == 0)
				mine.splice(i, 1);			
		}
	}		
	
	// Check storage size in the userdata		
	var mineString = (mine != "" ) ? mine.join("|") : ""; 
		
		
	// Check craft progress
	var craft = ((typeof userData.Craft != 'undefined') && (typeof userData.Craft.Value != 'undefined') && userData.Craft.Value != "") ? userData.Craft.Value.split('|') : "";
	for( i = 0; i < craft.length; i++)
	{
		if(craft[i] != "")
		{
			var buildingInfo =  craft[i].split (':');
			var buildingInstanceID = buildingInfo [0];
			
			// Deserialize the building queue, and iterate through them
			var progresses = buildingInfo [1].split ('-');		
			for( j = 0; j < progresses.length; j++)
			{
				// If this progress is empty continue the cycle.
				if (progresses[j] == "") continue;
				var info = progresses[j].split (',');
			
				// Check if the progress finished
				if(info [0] <= currTimeSeconds())
				{					
					items = [];
					items[items.length] = info[2]; 					
					server.GrantItemsToUser({ PlayFabId: currentPlayerId, ItemIds: items });
					
					progresses.splice(j, 1);
					needUpdate = true;
				}					
			}
			craft[i] = buildingInstanceID +":"+progresses.join('-');
			
			if( progresses.length == 0)
				craft.splice(i, 1);			
		}
	}		
	var craftString = (craft != "" ) ? craft.join("|") : ""; 
	
	
	
	
	if( needUpdate )
	{
		// Update the user data, and returns the results.
		server.UpdateUserData({
			PlayFabId: currentPlayerId,
			Data: {
				Construct : constructString,
				Mine : mineString,
				Craft: craftString				
				},
		});		
	}
	return { Balance: balance, UserDataConstruct: constructString, UserDataMine: mineString, UserDataCraft: craftString, serverTime: currTimeSeconds() };
}




/* This function start constructing or upgrading a building.
 * Parameters: ItemID, Position, Upgrade (number, 0 = new building)
 * Steps:
 *   1. Check if the player has worker to use.
 *   2. Check if the player has enough material
 *   3. If this is a new building, buy it.
 *   4. Set the building data (Position and Upgrades)
 */
handlers.Construct = function (args)
{
	var log = "LOG:";
	
	// Set the variables
	var itemID = args.ItemID;	
	var itemInstanceID = args.ItemInstanceID 	// Optional only for upgrading
	var position = args.Position;				// Where to place the constructed building
	
	// Query data
	var userData = server.GetUserData({ PlayFabId: currentPlayerId }).Data;
	var playerInventory = server.GetUserInventory({ PlayFabId: currentPlayerId, CatalogVersion: "Buildings" });	
	
	log += "ItemInstanceID: "+itemInstanceID+"\n";
	
	var itemInstance;
	if( typeof itemInstanceID != 'undefined' )
	{
		log += "Check for the item instance \n";
		
		for(i = 0; i < playerInventory.Inventory.length; i++)
		{
			log += " - "+playerInventory.Inventory[i].ItemInstanceId+" == "+itemInstanceID;
			if(playerInventory.Inventory[i].ItemInstanceId == itemInstanceID)
			{
				itemInstance = playerInventory.Inventory[i];
				break;
			}
		}	
	}
	
	/** 1. Check if the player has a free worker.	**/
	var underConstruction = ( typeof userData.Construct != 'undefined' && typeof userData.Construct.Value != 'undefined' ) ? userData.Construct.Value.split('|') : "";
	if((typeof playerInventory.VirtualCurrency.B < 1))
		return { error : "You don't have any worker!", serverTime: currTimeSeconds() };
	if(underConstruction.length + 1 > playerInventory.VirtualCurrency.B)
		return { error : "Not enough worker (has "+ playerInventory.VirtualCurrency.B + " and needs "+(underConstruction.length + 1)+" )!", serverTime: currTimeSeconds() };
	
	// Get the item data from the catalog
	var item;
	var itemList = server.GetCatalogItems({ CatalogVersion: "Buildings" }).Catalog;
	for(i = 0; i < itemList.length; i++)
	{
		if(itemList[i].ItemId == itemID)
		{
			item = itemList[i];
			break;
		}
	}	
	// If there is no such item in the catalog, throw an error.
	if( typeof item == 'undefined' )
		return { error : "Can't find item ("+itemID+") in the catalog ("+catalogVersion+")!", serverTime: currTimeSeconds()  }; 
		
	/** 2. Check if the player has enough material **/
	// Base price is X Wood. X is multiplied by every upgrades. 
	// New material is added after every 10th upgrades (Wood-Stone-Iron-Steel), and the price resets to the base price.
	
	var amount = parseInt(item.VirtualCurrencyPrices["WO"]);
	var balance = playerInventory.VirtualCurrency;
	
	if( !itemInstance )
	{
		if(playerInventory.VirtualCurrency["WO"] < amount)
			return { error : "You don't have enough wood to build this building!", serverTime: currTimeSeconds() }; 	
		if(playerInventory.VirtualCurrency["GC"] < item.VirtualCurrencyPrices["GC"])
			return { error : "You don't have enough gold to build this building!", serverTime: currTimeSeconds() }; 		
		
		if ( typeof amount != 'undefined' )		
			balance.WO = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "WO", Amount: amount}).Balance;	
		
		if ( typeof item.VirtualCurrencyPrices["GC"] != 'undefined' )
			balance.GC = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "GC", Amount: item.VirtualCurrencyPrices["GC"]}).Balance;		
	}
	else
	{
		var upgrade = parseInt(itemInstance.CustomData.Upgrade) + 1;
		var tier = parseInt(upgrade / 10);
		var amount = parseInt(amount * ( upgrade - tier * 10));
		
		// CHECK materials
		if( tier > 3 && playerInventory.VirtualCurrency["SI"] < amount)
			return { error : "You don't have enough steel to upgrade this building!", serverTime: currTimeSeconds() }; 		
		if( tier > 2 && playerInventory.VirtualCurrency["IR"] < amount)
			return { error : "You don't have enough iron to upgrade this building!", serverTime: currTimeSeconds() }; 			
		if( tier > 1 && playerInventory.VirtualCurrency["ST"] < amount)
			return { error : "You don't have enough stone to upgrade this building!", serverTime: currTimeSeconds() }; 		
		if( tier > 0 && playerInventory.VirtualCurrency["WO"] < amount)
			return { error : "You don't have enough wood to upgrade this building!", serverTime: currTimeSeconds() }; 
		
		if(playerInventory.VirtualCurrency["GC"] < item.VirtualCurrencyPrices["GC"] * upgrade/2)
			return { error : "You don't have enough gold to upgrade this building!", serverTime: currTimeSeconds() }; 
		
		// Buy		
		if( tier > 3 )
			balance.SI = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "SI", Amount: amount}).Balance;
		if( tier > 2 )
			balance.IR = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "IR", Amount: amount}).Balance;
		if( tier > 1 )
			balance.ST = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "ST", Amount: amount}).Balance;
		if( tier > 0 )
			balance.WO = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "WO", Amount: parseInt(amount)}).Balance;		
		
		balance.GC = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "GC", Amount: item.VirtualCurrencyPrices["GC"] * upgrade/2}).Balance;		
	}
		
	/** 3a. If this is a new building add it to the player. **/
	if ( !itemInstance )
	{
		log += "Item instance is null ("+itemInstance+") -> new item will be granted!";
		var grantResult = server.GrantItemsToUser({
						CatalogVersion:  "Buildings",
						PlayFabId: currentPlayerId,
						ItemIds: [itemID],
						Annotation: "Constructed.",
		}).ItemGrantResults;	
		
		// Granting the item failed
		if(!grantResult[0].Result)
			return { error : "Failed to grant the item ("+itemID+") to the user. " + grantResult[0].ItemId, serverTime: currTimeSeconds() };	
		
		itemInstanceID = grantResult[0].ItemInstanceId;
	}	
	
	// If the time is not instant
	var time = item.VirtualCurrencyPrices["T"];
	
	data = (typeof userData.Construct != 'undefined' && typeof userData.Construct.Value != 'undefined') ? userData.Construct.Value : "";
	if(time > 0)
	{			
		if( data != "" )
			data += "|";
			
		data += itemInstanceID+":"+ ( currTimeSeconds() + time );
		
		// Update the user "Crafting" data with this building.
		server.UpdateUserData({
				PlayFabId: currentPlayerId,
				Data: {Construct : data},
		});
	}
	
	// The custom data is a json string, first have to parse.
	// If only the Position would be updated in the UpdateUserInventoryItemCustomData method, it will
	// delete the other custom data fields for this item instance!
	var customData = JSON.parse(item.CustomData);	
	if( typeof position != "undefined")
	{
		customData.Position = position;
		customData.CurrHealth = customData.HP;
	}	
	else
		customData.CurrHealth = parseInt(customData.CurrHealth) + parseInt(customData.HP);
	
	customData.Upgrade = ( !itemInstance ) ? 0 : parseInt(itemInstance.CustomData.Upgrade) + 1;

	
	// Update the position data of the building
	server.UpdateUserInventoryItemCustomData({
		PlayFabId: currentPlayerId,
		ItemInstanceId: itemInstanceID,
		Data: customData
	});
	
	// Return the informations
	return { msg : log, ItemInstanceID: itemInstanceID, UserDataConstruct: data, Upgrade: customData.Upgrade, Balance: balance, serverTime: currTimeSeconds() };
}



/*This function starts a minding progress
 * Parameters: ItemID, BuildingInstanceID, SlotNumber
 * Steps:
 *   1. Check if the player has enough material
 *   2. Check if there is a free slot (not necesserily the given slot!)
 *   3. Collect datas: Material, Amount, Time
 *   4. Start to mine ( update player data )
 */
handlers.Mine = function (args)
{
	var log = "";
	var itemID = args.ItemID;
	var buildingInstanceID = args.ItemInstanceID;
	
	if( typeof buildingInstanceID == 'undefined' || buildingInstanceID == "")
		return { error : "Error: only a constructed building can mine!", serverTime: currTimeSeconds()  }; 
	
	// Get UserData
	var userData = server.GetUserData({ PlayFabId: currentPlayerId }).Data;
	
	// Get the building data from the catalog -
/**	Szerintem nem kell....**/
	/*var item;
	var itemList = server.GetCatalogItems({ CatalogVersion: "Buildings" }).Catalog;
	for(i = 0; i < itemList.length; i++)
	{
		if(itemList[i].ItemId == itemID)
		{
			item = itemList[i];
			break;
		}
	}	
	// If there is no such item in the catalog, throw an error.
	if( typeof item == 'undefined' )
		return { error : "Can't find item ("+itemID+") in the Buildings catalog!", serverTime: currTimeSeconds()  }; */
				
	// Get Building Instance
	var playerInventory = server.GetUserInventory({ PlayFabId: currentPlayerId, CatalogVersion: "Buildings" });	
	var buildingInstance;
	for(i = 0; i < playerInventory.Inventory.length; i++)
	{
		if(playerInventory.Inventory[i].ItemInstanceId == buildingInstanceID)
		{
			buildingInstance = playerInventory.Inventory[i];
			break;
		}
	}		
	if( typeof buildingInstance == 'undefined' )
		return { error : "You don't own this item ("+itemID+","+playerInventory.Inventory.length+")!", serverTime: currTimeSeconds()  }; 
	
	
	// Check storage
	// -- TODO --
		
	// Check for free mining slots	
	var cnt = -1;
	var mineProgresses = ( typeof userData.Mine != 'undefined' && typeof userData.Mine.Value != 'undefined' ) ? userData.Mine.Value.split('|') : "";
	for(i = 0; i < mineProgresses.length; i++)
	{
		var buildingData = mineProgresses[i].split(":");
		if( buildingData[0] == buildingInstanceID )
		{			
			var slots = buildingData[1].split("-");			
			if( slots.length >= parseInt(buildingInstance.CustomData.Upgrade / 10)+3)
				return { error : "You don't have free slot to make this material!", serverTime: currTimeSeconds()  }; 
			cnt = i;
		}		
	}	
	
	// Check prices
	var balance = playerInventory.VirtualCurrency;
	var pieces = parseInt(buildingInstance.CustomData.Upgrade)+1;
	var price = pieces * parseInt(buildingInstance.CustomData.Price);
	if(balance.GC < price)
		return { error : "You don't have enough gold!", serverTime: currTimeSeconds()  }; 		
	
	// Buy the material	
	balance.GC = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "GC", Amount: price}).Balance;		
	
	var data = "";
	var finishTime = 10;	
	
	if( cnt >= 0 )
	{
		var buildingData = mineProgresses[cnt].split(":");	
		if(buildingData[1] != "" )
		{
			var progresses = buildingData[1].split("-");
			var last = progresses[progresses.length-1].split(",");						
			finishTime += parseFloat(last[0]);
			progresses[progresses.length] = finishTime+","+pieces+","+buildingInstance.CustomData.Material;
			
			buildingData[1] = progresses.join("-");
		}			
		mineProgresses[cnt] = buildingData.join(":");
		data = mineProgresses.join('|');
	}
	else
		data = buildingInstanceID+":"+(parseFloat(finishTime)+currTimeSeconds())+","+pieces+","+buildingInstance.CustomData.Material;
	
	server.UpdateUserData({			
		PlayFabId: currentPlayerId,
		Data: {Mine : data},
	});
	
	
	// MINE DATA: 
	//		[BuildingInstanceID] : [finish],[amount],[material] - [finish],[amount],[material] - [finish],[amount],[material] |
	// 		[BuildingInstanceID] : [finish],[amount],[material] - [finish],[amount],[material] - [finish],[amount],[material] |
	
	
	return { msg : log, UserDataMine: data, Balance: balance, serverTime: currTimeSeconds() };
}

/* This function starts the craft progress.
 *  Parameters: BuildingInstanceID, ItemID, ItemCatalog
 *  
 */
handlers.Craft = function (args)
{
	var log = "";
	
	var itemID = args.ItemID;										// This is the item that will be crafted.
	var itemCatalog = args.ItemCatalog;								// The catalag of the item
	var buildingInstanceID = args.BuildingInstanceID; 				// This is the building instance ID, this building crafts the item.
	
	if( typeof buildingInstanceID == 'undefined' || buildingInstanceID == "")
		return { error : "Error: only a constructed building can mine!", serverTime: currTimeSeconds()  }; 
	
	// Get UserData
	var userData = server.GetUserData({ PlayFabId: currentPlayerId }).Data;
	
	// Get the card
	var catalog = server.GetCatalogItems({ CatalogVersion: itemCatalog }).Catalog;
	
	// Find item from the list
	var item;
	for(i = 0; i < catalog.length; i++)
	{
		if(catalog[i].ItemId == itemID)
		{
			item = catalog[i];
			break;
		}
	}	
	// If the item doesn't exists in this catalog
	if( typeof item == 'undefined' )
		return { error : "Can't find item ("+itemID+") in the inventory ("+itemCatalog+")!"  }; 
	
	
	// Get Building Instance
	var playerInventory = server.GetUserInventory({ PlayFabId: currentPlayerId, CatalogVersion: "Buildings" });	
	var buildingInstance;
	for(i = 0; i < playerInventory.Inventory.length; i++)
	{
		if(playerInventory.Inventory[i].ItemInstanceId == buildingInstanceID)
		{
			buildingInstance = playerInventory.Inventory[i];
			break;
		}
	}		
	if( typeof buildingInstance == 'undefined' )
		return { error : "You don't own this item ("+itemID+")!", serverTime: currTimeSeconds()  }; 
	
	
	// Check for free crafting slots	
	var cnt = -1;
	var craftProgresses = ( typeof userData.Craft != 'undefined' && typeof userData.Craft.Value != 'undefined' ) ? userData.Craft.Value.split('|') : "";
	for(i = 0; i < craftProgresses.length; i++)
	{
		var buildingData = craftProgresses[i].split(":");
		if( buildingData[0] == buildingInstanceID )
		{			
			var slots = buildingData[1].split("-");			
			if( slots.length >= parseInt(buildingInstance.CustomData.Upgrade / 10)+3)
				return { error : "You don't have free slot to make this card!", serverTime: currTimeSeconds()  }; 
			cnt = i;
		}		
	}	
	
	// Check prices
	var balance = playerInventory.VirtualCurrency;
	var pieces = parseInt(buildingInstance.CustomData.Upgrade)+1;
	var price = pieces * parseInt(item.VirtualCurrencyPrices.GC);
	if(balance.GC < price)
		return { error : "You don't have enough gold!", serverTime: currTimeSeconds()  }; 		
	
	// Buy the material	
	if( price > 0)
		balance.GC = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "GC", Amount: price}).Balance;		
	
	var data = "";
	var finishTime = parseFloat(item.VirtualCurrencyPrices.T);	
	
	if( cnt >= 0 )
	{
		var buildingData = craftProgresses[cnt].split(":");	
		if(buildingData[1] != "" )
		{
			var progresses = buildingData[1].split("-");
			var last = progresses[progresses.length-1].split(",");						
			finishTime += parseFloat(last[0]);
			progresses[progresses.length] = finishTime+","+pieces+","+itemID;
			
			buildingData[1] = progresses.join("-");
		}			
		craftProgresses[cnt] = buildingData.join(":");
		data = craftProgresses.join('|');
	}
	else
		data = buildingInstanceID+":"+(parseFloat(finishTime)+currTimeSeconds())+","+pieces+","+itemID;
	
	server.UpdateUserData({			
		PlayFabId: currentPlayerId,
		Data: {Craft : data},
	});
	
	
	// CRAFT DATA: 
	//		[BuildingInstanceID] : [finish],[amount],[itemID] - [finish],[amount],[itemID] - [finish],[amount],[itemID] |
	// 		[BuildingInstanceID] : [finish],[amount],[itemID] - [finish],[amount],[itemID] - [finish],[amount],[itemID] |
		
	return { msg : log, UserDataCraft: data, Balance: balance, serverTime: currTimeSeconds() };
}





/* This function buys a character and grant it to the user.
 *  Parameters: ItemID  
 */
handlers.BuyCharacter = function (args)
{
	var log = "";
	
	var itemID = args.ItemID;
	
	// Get the card
	var catalog = server.GetCatalogItems({ CatalogVersion: "Characters" }).Catalog;
	
	// Find item from the list
	var item;
	for(i = 0; i < catalog.length; i++)
	{
		if(catalog[i].ItemId == itemID)
		{
			item = catalog[i];
			break;
		}
	}	
	// If the item doesn't exists in this catalog
	if( typeof item == 'undefined' )
		return { error : "Can't find item ("+itemID+") in the catalog ("+itemCatalog+")!"  }; 
	
	
	// Get Building Instance
	var playerInventory = server.GetUserInventory({ PlayFabId: currentPlayerId, CatalogVersion: "Characters" });	
		
	// Check prices
	var balance = playerInventory.VirtualCurrency;
	var price = item.VirtualCurrencyPrices.GC;
	if(balance.GC < price)
		return { error : "You don't have enough gold!", serverTime: currTimeSeconds()  }; 		
	
	// Buy the character
	if( price > 0)
		balance.GC = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "GC", Amount: price}).Balance;		
	
	var data = "";

	var itemsToGrant = [itemID];
	var grantResult = server.GrantItemsToUser({
						PlayFabId: currentPlayerId,
						CatalogVersion: "Characters",
						ItemIds: itemsToGrant,
						Annotation: "Crafted.",
					}).ItemGrantResults;
				
	// Granting the item failed
	if(!grantResult[0].Result)
		return { error : "Failed to grant the item ("+itemsToGrant+") to the user." + log};		
		
	for(cnt = 0; cnt < grantResult.length; cnt++)
	{
		// Grant character to user
		grantResult[cnt].ItemInstanceId = server.GrantCharacterToUser({
								PlayFabId: currentPlayerId,
								CharacterName: grantResult[cnt].DisplayName,
								CharacterType: grantResult[cnt].ItemId,
						}).CharacterId;
	}	
		
	return { msg : log, GrantedCharacterID: grantResult[0].ItemId, GrantedCharacterInstanceID: grantResult[0].ItemInstanceId, Balance: balance, serverTime: currTimeSeconds() };
}





// query all the player characters and send back to the client
handlers.getItems = function(args)
{
	var items = [];
	var x = 0;
	for (i = 0; i < args.Catalogs.length; i++) 
	{ 
		var cat = server.GetCatalogItems({ CatalogVersion: args.Catalogs[i] }).Catalog;
		for( j = 0; j < cat.length; j++)
		{
			items[x] = cat[j];
			x++;
		}
	}	
	return { itemlist : items };	
}



// delete the character
handlers.battleReward = function(args)
{
	var charactersInBattle = server.GetUserData({ PlayFabId: currentPlayerId, Keys: ["CharactersForBattle"]}).Data["CharactersForBattle"].Value;
	charactersInBattle = charactersInBattle.split("|");
	
	var characters = server.GetAllUsersCharacters({
						PlayFabId: currentPlayerId
					});
		
	for (i = 0; i < characters.length; i++) 
	{
		var inBattle = false;
		for(x = 0; x < charactersInBattle.length; x++)
		{
			if(charactersInBattle[x] == characters[i].CharacterId)
			inBattle = true;
		}
	
		if(inBattle)
		{
			// Destroy every defense card			
			var equipments = server.GetCharacterInventory({
					PlayFabId: currentPlayerId,
					CharacterId: characters[i].CharacterId,
					CatalogVersion: "EquipmentCards"
			}).Inventory;
			
			for(j = 0; j < equipments.length; j++)
			{
				if(equipments[j].ItemClass == "defense")
				{
					server.MoveItemToUserFromCharacter({ 
								PlayFabId: currentPlayerId,
								CharacterId:characters[i].CharacterId, 
								ItemInstanceId: equipments[j].ItemInstanceId,
								});
				
					server.ModifyItemUses({ PlayFabId: currentPlayerId, ItemInstanceId:  equipments[j].ItemInstanceId, UsesToAdd: -1 * equipments[j].RemainingUses });				
				}

			}
		}
	}
	
	server.AddUserVirtualCurrency({
				PlayFabId: currentPlayerId,
				VirtualCurrency: "GC",
				Amount: args.Gold
	});
		
	return { };
}








/*********************************************************************************
*********************************** ADMIN FUNCTIONS ******************************
**********************************************************************************/

/* Deletes every character of the specified player.
 * Paramters: Username
 */
handlers.deleteAllCharacter = function(args)
{
	var user = GetUserAccountInfo( { Username: args.Username });
	if( user == null )
		return { msg : "The user with '"+args.Username+"' username doesn't exists!"}
	
	var characters = server.GetAllUsersCharacters( {  PlayFabId: user.PlayFabId } ).Characters;
	for(i = 0; i<characters.length; i++)
	{
		server.DeleteCharacterFromUser({
			PlayFabId: user.PlayFabId,
			CharacterId: characters[i].CharacterId,
		});
	}
	return { msg: "Deleted every character of the '"+args.Username+"' player "  };
}
