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
	var catalogVersion = args.CatalogVersion;
	
	// Get this item from the inventory
	var inventory = server.GetUserInventory({
					PlayFabId: currentPlayerId,
					CatalogVersion: catalogVersion,
					});
					
	// Get item instance id
	var itemInstanceID = "";
	for( i = 0; i < inventory.Inventory.length; i++)
	{
		if(inventory.Inventory[i].ItemId == itemID)
			itemInstanceID = inventory.Inventory[i].ItemInstanceId;
	}
	
	if (itemInstanceID == "")
		return { Error: "You don't own the item you want to sell!", serverTime: currTimeSeconds() };
	
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
	
	server.ModifyItemUses({ PlayFabId: currentPlayerId, ItemInstanceId: itemInstanceID, UsesToAdd: -1 });
	
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
	var userData = server.GetUserData({ PlayFabId: currentPlayerId, Keys: ["Construct"]}).Data;  // ADD more!
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
	 // Check storage size in the userdata
	
	// Check craft progress		
	
	if( needUpdate )
	{
		// Update the user data, and returns the results.
		server.UpdateUserData({
			PlayFabId: currentPlayerId,
			Data: {
				Construct : constructString
				},
		});		
	}
	return { UserDataConstruct: constructString, serverTime: currTimeSeconds() };
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
	
	// Get the building data from the catalog
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
		return { error : "Can't find item ("+itemID+") in the Buildings catalog!", serverTime: currTimeSeconds()  }; 
				
	// Get Building Instance
	var playerInventory = server.GetUserInventory({ PlayFabId: currentPlayerId, CatalogVersion: "Buildings" });	
	var buildingInstance;
	for(i = 0; i < playerInventory.Inventory.length; i++)
	{
		if(playerInventory.Inventory[i].ItemInstanceID == buildingInstanceID)
			buildingInstance = playerInventory.Inventory[i];
	}		
	if( typeof buildingInstance == 'undefined' )
		return { error : "You don't own this item ("+itemID+","+buildingInstanceID+")!", serverTime: currTimeSeconds()  }; 
	
	
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
			cnt = i;
			var slots = buildingData[1].split("-");			
			if( slots.length > parseInt(buildingInstance.CustomData.Upgrade / 10)+3)
				return { error : "You don't have free slot to make this material!", serverTime: currTimeSeconds()  }; 		
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
	
	var buildingData = mineProgresses[cnt].split(":");	
	var finishTime = currTimeSeconds() + 60;	
	buildingData[1] += finishTime+","+pieces+","+buildingInstance.CustomData.Material;
	mineProgresses[cnt] = buildingData.join(":");
	
	var data = mineProgresses.join('|');
	
	server.UpdateUserData({			
		PlayFabId: currentPlayerId,
		Data: {Mine : data},
	});
	
	
	// MINE DATA: 
	//		[BuildingInstanceID] : [finish],[amount],[material] - [finish],[amount],[material] - [finish],[amount],[material] |
	// 		[BuildingInstanceID] : [finish],[amount],[material] - [finish],[amount],[material] - [finish],[amount],[material] |
	
	
	return { msg : log, ItemInstanceID: itemInstanceID, UserDataMine: data, Balance: balance, serverTime: currTimeSeconds() };
}








/* This function start to mine a resources.
 * The function needs two parameter: BuildingInstanceID and CatalogVersion
 * The function first get the building from the inventory, then check if it's not null and it's a mine type.
 * After then, determines the mine parameters (what currency does it mine, how much does it time and how fast, also how much gold does it cost.
 * Next step is subtracting the players gold, if it has enough.
 * Last the function checks if the building already mining or not, and it will increase the mine amount or add the mining progress to the list.
 * 
 * The function returns the gold balance.
 */
handlers.startMine = function(args)	
{
	var log = "";

	var buildingInstanceID = args.BuildingInstanceID; 				// This is the building instance ID
	var catalogVersion = args.CatalogVersion;		// Mostly this is "Buildings"	
		
	// Query items form the given catalog
	var inventory = server.GetUserInventory({ PlayFabId: currentPlayerId, CatalogVersion: catalogVersion });
	var itemList = inventory.Inventory;
	
	var userData = server.GetUserData({ PlayFabId: currentPlayerId, Keys: ["Mine", "Construct"]}).Data;
	
	// Check if the building is under construction.
	var data = ((typeof userData.Construct != 'undefined') && (typeof userData.Construct.Value != 'undefined') && userData.Construct.Value != "") ? userData.Construct.Value.split('|') : "";
	for( i = 0; i < data.length; i++)
	{
		if(data[i] != "")
		{
			var progress = data[i].split(':');
			if(progress[0] == buildingInstanceID)
				return { error : "This building is currently under construction!"  };  
		}
	}
	
	// Find item from the list
	var item;
	for(i = 0; i < itemList.length; i++)
	{
		if(itemList[i].ItemInstanceId == buildingInstanceID)
		{
			item = itemList[i];
			break;
		}
	}
	
	// If there is no such item in the catalog, throw an error.
	if( typeof item == 'undefined' )
		return { error : "Can't find item ("+itemID+") in the inventory ("+catalogVersion+")!"  }; 
	
	if( item.ItemClass != "Mine")
		return { error : "The "+item.ItemId+" is not a mine!" }; 
	
	var virtualCurrency = item.CustomData.Currency;
	var creationAmount = item.CustomData.CreationAmount;
	var creationTime = item.CustomData.CreationTime;
	var goldCost = item.CustomData.CreationCost;
	
	// Spend Gold if possible.
	if(goldCost > 0)
	{
		var currency = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "GC", Amount: goldCost });
		if(currency.Balance < 0)
		{
			server.AddUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "GC", Amount: goldCost });
			return { error : "Not enough "+currency.VirtualCurrency +"!" };
		}	
	}
	else
		var currency = { Balance : inventory.VirtualCurrency.GC };
	
	// Get user data, mine progresses
	var data = ((typeof userData.Mine != 'undefined') && (typeof userData.Mine.Value != 'undefined') && userData.Mine.Value != "") ? userData.Mine.Value.split('|') : [];
	
	for( i = 0; i < data.length; i++)
	{
		if(data[i] != "")
		{
			var progress = data[i].split(','); 
			if(progress[0] == buildingInstanceID)
			{
				progress[3] = parseInt(progress[3]) + creationAmount;
				data[i] = progress.join(",");	
				
				server.UpdateUserData({
						PlayFabId: currentPlayerId,
						Data: {Mine : data.join("|")},
					});
				
				return { msg : log, Balance: { GC: currency.Balance}, Parameter:  progress[3]};
			}					
		}
	}	
	// 0: Building  -  1: finish time  -  2: amount  -  3: finish time  -  4: amount unit  -  5: currency
	data[data.length] = buildingInstanceID+","+(currTimeSeconds()+creationTime)+","+creationAmount+","+creationTime+","+creationAmount+","+virtualCurrency;
	server.UpdateUserData({
						PlayFabId: currentPlayerId,
						Data: {Mine : data.join("|")},
					});
	
	return { msg : log, Balance: { GC: currency.Balance}, Parameter: creationAmount};
}


handlers.checkMiningProgress = function(args)
{
	var buildingInstanceID = args.BuildingInstanceID;

	// Get the Construct custom user data, and explode it into an array.
	var userData = server.GetUserData({ PlayFabId: currentPlayerId, Keys: ["Mine"]}).Data;
	var data = ((typeof userData.Mine != 'undefined') && (typeof userData.Mine.Value != 'undefined') && userData.Mine.Value != "") ? userData.Mine.Value.split('|') : "";
	for( i = 0; i < data.length; i++)
	{
		if(data[i] != "")
		{
			var progress = data[i].split(',');
			// If this is the mine we searching for.
			if(progress[0] == buildingInstanceID)
			{		
				// If it's almost ready.
				if(progress[1] <= currTimeSeconds() - 2)
				{
					var finished = true;
					if(progress[2] == progress[4])
						data.splice(i, 1)
					else
					{						
						progress[2] = progress[2] - progress[4];
						progress[1] = currTimeSeconds() + progress[3];
						data[i] = progress.join(",");
						finished = false;
					}
									
					server.UpdateUserData({
						PlayFabId: currentPlayerId,
						Data: { Mine : data.join("|") },
					});
					
					var currency = server.AddUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: progress[5], Amount: progress[4] });
					
					var balance = {};
					balance[progress[5]] = currency.Balance;
					
					if(finished)
						return { BuildingInstanceID : buildingInstanceID,  status : "Finished",	  Parameter: balance };
					else
						return { BuildingInstanceID : buildingInstanceID,  status : "In progress", TimeBack : progress[1] - currTimeSeconds(), Amount : progress[2] };
				}
				else
					return { BuildingInstanceID : buildingInstanceID,  status : "In progress", TimeBack : progress[1] - currTimeSeconds(), Amount : progress[2] };
			}			
		}
	}		
	return { error : "There is no craft progress for " + buildingInstanceID };	
}


/******************************************************** CRAFT ************************************************************************/


/*
 */
handlers.startCraft = function(args)	
{
	var currentTime = currTimeSeconds();
	
	var log = "";
	
	var itemID = args.ItemID;										// This is the item that will be crafted.
	var itemCatalog = args.ItemCatalog;								// The catalag of the item
	var buildingInstanceID = args.BuildingInstanceID; 				// This is the building instance ID, this building crafts the item.
	var buildingCatalog = args.BuildingCatalog;						// Mostly this is "Buildings"	

	
	
/** GET THE BUILDING **/
	var inventory = server.GetUserInventory({ PlayFabId: currentPlayerId, CatalogVersion: buildingCatalog });
	var buildings = inventory.Inventory;
	
	// Find the building
	var building;
	for(i = 0; i < buildings.length; i++)
	{
		if(buildings[i].ItemInstanceId == buildingInstanceID)
		{
			building = buildings[i];
			break;
		}
	}
	
	// If the building doesn't exists in this catalog
	if( typeof building == 'undefined' )
		return { error : "Can't find item ("+building.ItemId+") in the inventory ("+buildingCatalog+")!"  }; 
		
	if( building.ItemClass != "CraftStation")
		return { error : "The "+building.ItemId+" is not a craft station!" }; 
		
	var userData = server.GetUserData({ PlayFabId: currentPlayerId, Keys: ["Construct", "Craft"]}).Data;
		
	// Check if the building is under construction.
	var data = ((typeof userData.Construct != 'undefined') && (typeof userData.Construct.Value != 'undefined') && userData.Construct.Value != "") ? userData.Construct.Value.split('|') : "";
	for( i = 0; i < data.length; i++)
	{
		if(data[i] != "")
		{
			var progress = data[i].split(':');
			if(progress[0] == buildingInstanceID)
				return { error : "This building is currently under construction!"  };  
		}
	}	
		
	// Check if the building can craft an item from the catalog
	if(building.CustomData.Catalog  != itemCatalog)
		return { error : "This building ("+building.ItemId+") can't craft item from this catalog ("+itemCatalog+")" }; 

	
/** GET THE ITEM **/
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
	
	
	var creationAmount = building.CustomData.CreationAmount;
	
	// try to subtract the currency
	var currencies = [];
	var currencyBalances = {};
	for (x in item.VirtualCurrencyPrices) 
	{
		if( x != "T" && item.VirtualCurrencyPrices[x] > 0)
		{
			var currency = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: x, Amount: item.VirtualCurrencyPrices[x]});
			currencies[currencies.length] = x;
			currencyBalances[x] = currency.Balance;
			
			// If there aren't enough, throw an error.
			if(currency.Balance < 0)
			{
				for( cnt = 0; cnt < currencies.length; cnt++)
				{
					server.AddUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: currencies[cnt], Amount: item.VirtualCurrencyPrices[currencies[cnt]] });
				}
				return { error : "Not enough "+currency.VirtualCurrency +"!" };
			}			
		}
	}
	
	// update player data
	var craft = ((typeof userData.Craft != 'undefined') && (typeof userData.Craft.Value != 'undefined') && userData.Craft.Value != "") ? userData.Craft.Value.split('|') : [];
	var hasCraftProgress = false;
	var queue = "";
	for( i = 0; i < craft.length; i++)
	{
		if(craft[i] != "")
		{
			var info = craft[i].split(','); 
			
			// If the building already has a craft progress
			if(info[0] == buildingInstanceID)
			{
				hasCraftProgress = true;
				
				if(info[4] != "")
					info[4] += ";";
				info[4] += itemID +":"+itemCatalog+":"+item.VirtualCurrencyPrices.T;
				queue = info[4];
				
				craft[i] = info.join(',');
				server.UpdateUserData({
						PlayFabId: currentPlayerId,
						Data: { Craft : craft.join("|") },
					});				
			}
		}
	}
	
	if(!hasCraftProgress)
	{
		craft[craft.length] = buildingInstanceID+","+itemID+","+itemCatalog+","+(item.VirtualCurrencyPrices.T + currentTime)+",";
		server.UpdateUserData({
						PlayFabId: currentPlayerId,
						Data: { Craft : craft.join("|") },
					});
	}
		
	return { msg : log, Balance: currencyBalances, Parameter: queue, ServerWork: currTimeSeconds() - currentTime };
}

// 0 - BuildingInstanceID, 1 - currentItem, 2 - catalogVersion, 3 - finishTime, 4 - queue [ 0 - itemID : 1 - catalog : 2 - craftTime (;)]
handlers.checkCraftProgress = function(args)
{
	var log = "";
	var buildingInstanceID = args.BuildingInstanceID;

	var userData = server.GetUserData({ PlayFabId: currentPlayerId, Keys: ["Craft"]}).Data;
	var data = ((typeof userData.Craft != 'undefined') && (typeof userData.Craft.Value != 'undefined') && userData.Craft.Value != "") ? userData.Craft.Value.split('|') : "";
	
	var currentCatalog;
	
	for( i = 0; i < data.length; i++)
	{
		if(data[i] != "")
		{
			var progress = data[i].split(',');
			
			// If this is the mine we searching for.
			if(progress[0] == buildingInstanceID)
			{				
				var done = false;
				var currentItem = progress[1];
				currentCatalog = progress[2];
				var currentFinishTime = progress[3];
				
				var queue = (progress[4] == "") ? [] : progress[4].split(';');
				
				var itemsToGrant = [];
				
				while(!done)
				{		
					// check if the current craft finished or not.				
					if(currentFinishTime <= currTimeSeconds() + 2)
					{
						// Add the item to the list that will be granted to the player.
						itemsToGrant[itemsToGrant.length] = currentItem; 
						currentItem = "";
						
						log += "Queue: " + queue.length + "\n";
												
						// If there is no queue, exit from this loop
						if(queue.length == 0)					
							done = true;								
						
						// If there is a queue add the next item to the craft
						else
						{
							var next = queue[0].split(':');
							currentItem = next[0];
							currentCatalog = next[1];
							currentFinishTime = currTimeSeconds() + 2 + next[2];
							queue.splice(0,1);
						}
					}
					
					// If it's not finished yet, exit from the loop.
					else
						done = true;								
				}
								
				// Grant the items to the user	
				var grantedItems = [];
				if(itemsToGrant.length > 0)
				{			
					var grantResult = server.GrantItemsToUser({
											PlayFabId: currentPlayerId,
											CatalogVersion: currentCatalog,
											ItemIds: itemsToGrant,
											Annotation: "Crafted.",
							}).ItemGrantResults;
						
					// Granting the item failed
					if(!grantResult[0].Result)
						return { error : "Failed to grant the item ("+itemsToGrant+") to the user." + log};		
						
					for(cnt = 0; cnt < grantResult.length; cnt++)
					{
						if(currentCatalog == "Characters")
						{
							// Grant character to user
							grantResult[cnt].ItemInstanceId = server.GrantCharacterToUser({
																		PlayFabId: currentPlayerId,
																		CharacterName: grantResult[cnt].ItemId,
																		CharacterType: grantResult[cnt].ItemId,
																	}).CharacterId;
						}						
						grantedItems[grantedItems.length] = { ItemId: grantResult[cnt].ItemId, ItemInstanceId: grantResult[cnt].ItemInstanceId, CatalogVersion: currentCatalog };
						
					}
				}
				
				// Update the craft custom data
				if(queue.length == 0 && currentItem == "" )
					data.splice(i, 1);				
				else
				{
					progress[1] = currentItem;
					progress[2] = currentCatalog;
					progress[3] = currentFinishTime;
					progress[4] = queue.join(';');
					data[i] = progress.join(',');					
				}					
				
				server.UpdateUserData({
						PlayFabId: currentPlayerId,
						Data: { Craft : data.join("|") },
					});
				
			
				if(queue.length == 0 && currentItem == "" )
					return {msg : log, BuildingInstanceID : buildingInstanceID,  status : "Finished", Parameter: grantedItems };
				else
					return {msg : log, BuildingInstanceID : buildingInstanceID,  status : "In progress", ItemID : progress[1], TimeBack : progress[3] - currTimeSeconds(), Queue: progress[4], Parameter: grantedItems};
			}			
		}
	}		
	return { error : "There is no craft progress for " + buildingInstanceID };	
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




/*
handlers.buyItem = function(args)
{
	var items = [args.ItemID];

	var itemList = server.GetCatalogItems().Catalog;
	var value = 0;
	
	for(i = 0; i<itemList.length; i++)
	{
		if(itemList[i].ItemId == args.ItemID)
			value = itemList[i].VirtualCurrencyPrices.GC;
	}
	
	server.GrantItemsToUser({
			PlayFabId: currentPlayerId,
			ItemIds: items
	});
	
	server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "GC", Amount: value});
		
	var inventory = server.GetUserInventory({ PlayFabId: currentPlayerId });	
	return {  Inventory : inventory.Inventory, Currency: inventory.VirtualCurrency };
}*/










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
