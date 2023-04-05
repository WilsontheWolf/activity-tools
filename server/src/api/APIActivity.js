import Activity from "../../../shared/Activity.mjs"

class APIActivity extends Activity {
    constructor(data, id, lastUpdated) {
        super(data, id);
        this.lastUpdated = lastUpdated;
    }

    static tryActivity(data, id, lastUpdated) {
        try {
            return new APIActivity(data, id, lastUpdated);
        } catch (e) {
            return null;
        }
    }


    toJSON() {
        return {
            ...super.toJSON(),
            lastUpdated: this.lastUpdated,
        };
    }
}

export default APIActivity;