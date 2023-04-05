class Activity {
    constructor(data, id) {
        this.add('state', data.state);
        this.add('details', data.details);
        this.add('timestamps', data.timestamps);
        this.add('assets', data.assets);
        this.add('party', data.party);
        // this.add('secrets', data.secrets); // We don't need secrets
        this.add('instance', data.instance);
        this.add('buttons', data.buttons);
        
        this.id = id;

        this.validate();
    }

    add(key, value) {
        // If empty object, don't add
        // Some clients are weird that way
        if (typeof value === 'object' && Object.keys(value).length === 0) return;
        this[key] = value;
    }

    validate() {
        if (!['string', 'undefined'].includes(typeof this.state)) throw new TypeError('Activity state must be a string');
        if (!['string', 'undefined'].includes(typeof this.details)) throw new TypeError('Activity details must be a string');
        if (!['object', 'undefined'].includes(typeof this.timestamps)) throw new TypeError('Activity timestamps must be an object');
        if (!['number', 'undefined'].includes(typeof this.timestamps?.start)) throw new TypeError('Activity timestamps start must be a number');
        if (!['number', 'undefined'].includes(typeof this.timestamps?.end)) throw new TypeError('Activity timestamps end must be a number');
        if (!['object', 'undefined'].includes(typeof this.assets)) throw new TypeError('Activity assets must be an object');
        if (!['string', 'undefined'].includes(typeof this.assets?.large_image)) throw new TypeError('Activity assets large_image must be a string');
        if (!['string', 'undefined'].includes(typeof this.assets?.large_text)) throw new TypeError('Activity assets large_text must be a string');
        if (!['string', 'undefined'].includes(typeof this.assets?.small_image)) throw new TypeError('Activity assets small_image must be a string');
        if (!['string', 'undefined'].includes(typeof this.assets?.small_text)) throw new TypeError('Activity assets small_text must be a string');
        if (!['object', 'undefined'].includes(typeof this.party)) throw new TypeError('Activity party must be an object');
        if (!['string', 'undefined'].includes(typeof this.party?.id)) throw new TypeError('Activity party id must be a string');
        if (!['undefined'].includes(typeof this.party?.size) && (!Array.isArray(this.party?.size) || this.party?.size !== 2)) throw new TypeError('Activity party must be an array of length 2');
        if (!['number', 'undefined'].includes(typeof this.party?.size[0])) throw new TypeError('Activity party size[0] must be a number');
        if (!['number', 'undefined'].includes(typeof this.party?.size[1])) throw new TypeError('Activity party size[1] must be a number');
        if (!['boolean', 'undefined'].includes(typeof this.instance)) throw new TypeError('Activity instance must be a boolean');
        if (!['undefined'].includes(typeof this.buttons) && !Array.isArray(this.buttons)) throw new TypeError('Activity buttons must be an array');
        if (this.buttons?.some(b => b?.label === undefined || b?.url === undefined)) throw new TypeError('Activity buttons must have a label and a url');
    }

    rpcURL() {
        if(!this.id) throw new Error('Activity must have an ID');
        return `https://discord.com/api/v9/oauth2/applications/${this.id}/rpc`;
    }

    assetsURL() {
        if(!this.id) throw new Error('Activity must have an ID');
        return `https://discord.com/api/v9/oauth2/applications/${this.id}/assets`;
    }

    getAssetURLFromID(assetID) {
        if (!this.id) throw new Error('Activity must have an ID');
        return `https://cdn.discordapp.com/app-assets/${assetID}/${this.id}.png`;
    }

    toJSON() {
        return {
            state: this.state,
            details: this.details,
            timestamps: this.timestamps,
            assets: this.assets,
            party: this.party,
            instance: this.instance,
            buttons: this.buttons,
            id: this.id,
        }
    }

    static tryActivity(data, id) {
        try {
            return new Activity(data, id);
        } catch (e) {
            console.log('DEBUG: Invalid activity', e)
            return null;
        }
    }
        
}

export default Activity;